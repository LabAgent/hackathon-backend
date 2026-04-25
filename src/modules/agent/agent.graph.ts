import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { ConfigService } from '@nestjs/config';
import { PLANNER_TOOLS, RESEARCH_TOOLS, INVENTORY_TOOLS, DATABASE_TOOLS } from './tools/definitions';
import { ToolExecutor } from './tools/executor';

interface AgentNodeConfig {
  name: string;
  systemPrompt: string;
  tools: any[];
}

interface AgentState {
  query: string;
  userId: string;
  role: string;
  messages: any[];
  currentAgent: string;
  finalResponse: string;
  agentSteps: any[];
}

type ProgressEmitter = (event: any) => void;

const AGENT_CONFIGS: Record<string, AgentNodeConfig> = {
  planner: {
    name: 'Planner',
    systemPrompt: `You are Sandy Cheeks' Lab Planner Agent — the central coordinator of the Treedome Lab AI system.

Your job is to understand the user's request and delegate it to the appropriate specialist agent.

Available agents:
- **research**: For web search, experiment ideas, hypothesis generation, analyzing research findings, scientific questions
- **inventory**: For checking stock levels, managing lab supplies, low stock alerts, reorder suggestions
- **database**: For querying, creating, updating, or deleting records in research projects, experiments, or inventory

Rules:
1. Analyze the user's intent carefully
2. Use route_to_agent to delegate to the MOST relevant agent
3. If a request involves multiple agents, route to the primary one first
4. After getting results back, synthesize a clear, helpful response
5. Be enthusiastic and use SpongeBob-themed lab terminology occasionally
6. Always explain what you're doing before routing`,
    tools: PLANNER_TOOLS,
  },
  research: {
    name: 'Research',
    systemPrompt: `You are Sandy's Research Agent — a specialist in scientific research and web search.

Your capabilities:
- Search the web for scientific articles, papers, and information
- Create experiment logs for projects
- Suggest hypotheses based on research topics
- Analyze findings from projects

Rules:
1. Use web_search to find relevant scientific information
2. Use create_experiment_log to add experiment results to projects (requires projectId as number)
3. Use suggest_hypothesis to generate hypotheses
4. Use analyze_findings to review project data (requires projectId as number)
5. Be thorough and cite your sources when providing web search results
6. Present information in a structured, scientific manner`,
    tools: RESEARCH_TOOLS,
  },
  inventory: {
    name: 'Inventory',
    systemPrompt: `You are Sandy's Inventory Agent — a specialist in lab inventory management.

Your capabilities:
- Check stock levels for any inventory item
- Update stock quantities (automatically logs transactions)
- Alert on low stock items
- Suggest reorder quantities

Rules:
1. Use check_stock to look up items
2. Use update_stock to change quantities (requires itemId as number, newQuantity as number)
3. Use alert_low_stock to find items below min_required
4. Use suggest_reorder for restocking recommendations
5. Always confirm before making changes to stock
6. Report quantities clearly with units`,
    tools: INVENTORY_TOOLS,
  },
  database: {
    name: 'Database',
    systemPrompt: `You are Sandy's Database Agent — a specialist in safe database operations.

Your capabilities:
- Query records from: projects, inventory, experiments_log, ai_actions_log, research_cache, inventory_transactions, agent_tasks
- Create new records in: projects, inventory, experiments_log, agent_tasks
- Update existing records
- Delete records

Rules:
1. Use query_records to fetch data with filters
2. Use create_record to add new entries
3. Use update_record to modify existing data (id is a number)
4. Use delete_record to remove records (id is a number)
5. Always confirm destructive operations
6. Validate data before creating/updating records`,
    tools: DATABASE_TOOLS,
  },
};

@Injectable()
export class AgentGraph {
  private readonly logger = new Logger(AgentGraph.name);
  private readonly glm: OpenAI;

  constructor(
    private toolExecutor: ToolExecutor,
    private configService: ConfigService,
  ) {
    this.glm = new OpenAI({
      apiKey: this.configService.get('ZAI_API_KEY'),
      baseURL: 'https://api.z.ai/api/paas/v4/',
    });
  }

  async run(
    query: string,
    userId: string,
    role: string,
    onProgress: ProgressEmitter,
  ): Promise<{ response: string; agentSteps: any[] }> {
    const state: AgentState = {
      query,
      userId,
      role,
      messages: [],
      currentAgent: 'planner',
      finalResponse: '',
      agentSteps: [],
    };

    const plannerConfig = AGENT_CONFIGS.planner;
    state.messages.push({
      role: 'system',
      content: plannerConfig.systemPrompt,
    });
    state.messages.push({
      role: 'user',
      content: query,
    });

    onProgress({ type: 'agent_start', agent: 'planner', message: 'Planner Agent analyzing your request...' });

    let iterations = 0;
    const MAX_ITERATIONS = 15;

    while (iterations < MAX_ITERATIONS) {
      iterations++;
      const agentConfig = AGENT_CONFIGS[state.currentAgent];

      if (state.currentAgent !== 'planner') {
        state.messages.push({
          role: 'system',
          content: agentConfig.systemPrompt,
        });
      }

      try {
        const completed = await this.runAgentTurn(state, agentConfig, onProgress);
        if (completed) break;
      } catch (error) {
        this.logger.error(`Agent turn failed: ${error.message}`);
        onProgress({ type: 'tool_error', agent: state.currentAgent, message: error.message });
        state.finalResponse = 'I encountered an error processing your request. Please try again.';
        break;
      }
    }

    if (!state.finalResponse && state.messages.length > 0) {
      const lastAssistant = [...state.messages].reverse().find(m => m.role === 'assistant' && m.content);
      state.finalResponse = lastAssistant?.content || 'I was unable to complete your request.';
    }

    return { response: state.finalResponse, agentSteps: state.agentSteps };
  }

  private async runAgentTurn(
    state: AgentState,
    agentConfig: AgentNodeConfig,
    onProgress: ProgressEmitter,
  ): Promise<boolean> {
    const stream = await this.glm.chat.completions.create({
      model: 'glm-5.1',
      messages: state.messages,
      tools: agentConfig.tools,
      tool_choice: 'auto',
      stream: true,
    } as any) as any;

    let reasoning = '';
    let content = '';
    const toolCalls: any[] = [];

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (!delta) continue;

      if ((delta as any).reasoning_content) {
        reasoning += (delta as any).reasoning_content;
        onProgress({ type: 'reasoning', agent: state.currentAgent, chunk: (delta as any).reasoning_content });
      }

      if (delta.content) {
        content += delta.content;
        onProgress({ type: 'content', agent: state.currentAgent, chunk: delta.content });
      }

      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index;
          if (!toolCalls[idx]) {
            toolCalls[idx] = { id: tc.id, function: { name: '', arguments: '' } };
          }
          if (tc.function?.name) toolCalls[idx].function.name += tc.function.name;
          if (tc.function?.arguments) toolCalls[idx].function.arguments += tc.function.arguments;
          if (tc.id) toolCalls[idx].id = tc.id;
        }
      }
    }

    const validToolCalls = toolCalls.filter(tc => tc.id);

    const assistantMsg: any = { role: 'assistant', content: content || null };
    if (reasoning) assistantMsg.reasoning_content = reasoning;
    if (validToolCalls.length > 0) {
      assistantMsg.tool_calls = validToolCalls.map(tc => ({
        id: tc.id,
        type: 'function',
        function: tc.function,
      }));
    }
    state.messages.push(assistantMsg);

    if (validToolCalls.length === 0) {
      state.finalResponse = content;
      state.agentSteps.push({
        agent: state.currentAgent,
        action: 'response',
        content: content?.substring(0, 200),
      });
      return true;
    }

    for (const tc of validToolCalls) {
      const toolName = tc.function.name;
      let args: any = {};
      try {
        args = JSON.parse(tc.function.arguments || '{}');
      } catch {}

      if (toolName === 'route_to_agent') {
        const targetAgent = args.agent;
        const task = args.task;
        onProgress({ type: 'route', from: state.currentAgent, to: targetAgent, task });

        state.agentSteps.push({
          agent: state.currentAgent,
          action: 'route',
          target: targetAgent,
          task,
        });

        state.messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify({ routed: true, agent: targetAgent }),
        });

        state.currentAgent = targetAgent;
        state.messages.push({
          role: 'user',
          content: `[Delegated task]: ${task}`,
        });
        return false;
      }

      onProgress({ type: 'tool_call', agent: state.currentAgent, tool: toolName, args });

      const result = await this.toolExecutor.execute(toolName, args, state.userId, (msg) => {
        onProgress({ type: 'tool_progress', agent: state.currentAgent, message: msg });
      });

      onProgress({ type: 'tool_result', agent: state.currentAgent, tool: toolName, result: JSON.stringify(result).substring(0, 200) });

      state.agentSteps.push({
        agent: state.currentAgent,
        action: 'tool_call',
        tool: toolName,
        args,
        resultSummary: JSON.stringify(result).substring(0, 100),
      });

      state.messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: JSON.stringify(result),
      });
    }

    if (state.currentAgent !== 'planner') {
      state.currentAgent = 'planner';
      state.messages.push({
        role: 'user',
        content: 'The specialist agent has completed its work. Please synthesize the results and provide a clear response to the user.',
      });
    }

    return false;
  }
}
