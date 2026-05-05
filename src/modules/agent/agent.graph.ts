import { Injectable, Logger } from '@nestjs/common';
import {
  StateGraph,
  Annotation,
  START,
  END,
  Command,
} from '@langchain/langgraph';
import OpenAI from 'openai';
import { ConfigService } from '@nestjs/config';
import { ToolExecutor } from './tools/executor';
import { AGENT_CONFIGS } from './agents';

const AgentGraphState = Annotation.Root({
  messages: Annotation<any[]>({
    reducer: (existing, update) => [...existing, ...update],
    default: () => [],
  }),
  currentAgent: Annotation<string>,
  finalResponse: Annotation<string>,
  agentSteps: Annotation<any[]>({
    reducer: (existing, update) => [...existing, ...update],
    default: () => [],
  }),
  query: Annotation<string>,
  userId: Annotation<string>,
  role: Annotation<string>,
  iterations: Annotation<number>({
    reducer: (_existing, update) => update,
    default: () => 0,
  }),
});

type AgentState = typeof AgentGraphState.State;

type ProgressEmitter = (event: any) => void;

@Injectable()
export class AgentGraph {
  private readonly logger = new Logger(AgentGraph.name);
  private readonly glm: OpenAI;
  private readonly model: string;
  private compiledGraph: any;

  private sanitizeForApi(messages: any[], tools: any[]): any[] {
    const toolNames = new Set(
      tools.map((t: any) => t.function?.name).filter(Boolean),
    );
    const skipToolIds = new Set<string>();

    return messages
      .map((m) => {
        const { reasoning_content, ...rest } = m;
        return rest;
      })
      .filter((m) => {
        if (m.role === 'tool' && skipToolIds.has(m.tool_call_id)) {
          return false;
        }

        if (m.role === 'assistant' && m.tool_calls) {
          const hasUnknownTools = m.tool_calls.some(
            (tc: any) => !toolNames.has(tc.function?.name),
          );
          if (hasUnknownTools) {
            for (const tc of m.tool_calls) {
              skipToolIds.add(tc.id);
            }
            return m.content != null;
          }
        }

        if (m.role === 'assistant' && !m.content && !m.tool_calls) {
          return false;
        }

        return true;
      })
      .map((m) => {
        if (m.role === 'assistant' && m.tool_calls) {
          const hasUnknownTools = m.tool_calls.some(
            (tc: any) => !toolNames.has(tc.function?.name),
          );
          if (hasUnknownTools) {
            const { tool_calls, ...rest } = m;
            return rest;
          }
        }
        return m;
      });
  }

  constructor(
    private toolExecutor: ToolExecutor,
    private configService: ConfigService,
  ) {
    this.model = this.configService.get('AI_MODEL', 'openai/gpt-4o-mini');
    this.glm = new OpenAI({
      apiKey: this.configService.get('OPENROUTER_API_KEY'),
      baseURL: 'https://openrouter.ai/api/v1',
      maxRetries: 3,
      timeout: 30000,
      defaultHeaders: {
        'HTTP-Referer': 'https://treedome-lab.app',
        'X-Title': 'Treedome Lab',
      },
    });
    this.compiledGraph = this.buildGraph();
  }

  private buildGraph() {
    const graph = new StateGraph(AgentGraphState)
      .addNode('planner', this.plannerNode.bind(this))
      .addNode('research', this.specialistNode('research').bind(this))
      .addNode('inventory', this.specialistNode('inventory').bind(this))
      .addNode('database', this.specialistNode('database').bind(this))
      .addEdge(START, 'planner')
      .addConditionalEdges('planner', this.routeFromPlanner.bind(this))
      .addEdge('research', 'planner')
      .addEdge('inventory', 'planner')
      .addEdge('database', 'planner');

    return graph.compile();
  }

  private routeFromPlanner(state: AgentState): string {
    if (state.finalResponse && state.finalResponse.trim().length > 0) {
      return END;
    }
    const agent = state.currentAgent;
    if (agent && ['research', 'inventory', 'database'].includes(agent)) {
      return agent;
    }
    return END;
  }

  private async plannerNode(
    state: AgentState,
    config?: any,
  ): Promise<Partial<AgentState>> {
    const onProgress: ProgressEmitter =
      config?.configurable?.onProgress || (() => {});

    onProgress({
      type: 'agent_start',
      agent: 'planner',
      message: 'Planner Agent analyzing your request...',
    });

    const messages = [...state.messages];
    if (messages.length === 0) {
      messages.push({
        role: 'system',
        content: AGENT_CONFIGS.planner.systemPrompt,
      });
      messages.push({ role: 'user', content: state.query });
    } else {
      messages.push({
        role: 'system',
        content: AGENT_CONFIGS.planner.systemPrompt,
      });
      messages.push({
        role: 'user',
        content:
          'The specialist agent has completed its work. Please synthesize the results and provide a clear response to the user.',
      });
    }

    let stream: any;
    let lastError: any;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        stream = await this.glm.chat.completions.create({
          model: this.model,
          messages: this.sanitizeForApi(messages, AGENT_CONFIGS.planner.tools) as any,
          tools: AGENT_CONFIGS.planner.tools as any,
          tool_choice: 'auto',
          max_tokens: 4096,
          stream: true,
        } as any);
        break;
      } catch (err: any) {
        lastError = err;
        this.logger.warn(`Planner API attempt ${attempt + 1} failed: ${err.message}`);
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        }
      }
    }
    if (!stream) {
      throw lastError;
    }

    let reasoning = '';
    let content = '';
    const toolCalls: any[] = [];

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (!delta) continue;

      if (delta.reasoning_content) {
        reasoning += delta.reasoning_content;
        onProgress({
          type: 'reasoning',
          agent: 'planner',
          chunk: delta.reasoning_content,
        });
      }

      if (delta.content) {
        content += delta.content;
        onProgress({ type: 'content', agent: 'planner', chunk: delta.content });
      }

      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0;
          if (!toolCalls[idx]) {
            toolCalls[idx] = {
              id: tc.id || '',
              function: { name: '', arguments: '' },
            };
          }
          if (tc.function?.name)
            toolCalls[idx].function.name += tc.function.name;
          if (tc.function?.arguments)
            toolCalls[idx].function.arguments += tc.function.arguments;
          if (tc.id) toolCalls[idx].id = tc.id;
        }
      }
    }

    const validToolCalls = toolCalls.filter((tc) => tc.id);
    const assistantMsg: any = { role: 'assistant', content: content || null };
    if (reasoning) assistantMsg.reasoning_content = reasoning;
    if (validToolCalls.length > 0) {
      assistantMsg.tool_calls = validToolCalls.map((tc) => ({
        id: tc.id,
        type: 'function',
        function: tc.function,
      }));
    }

    const newMessages: any[] = [assistantMsg];
    const newSteps: any[] = [];

    if (validToolCalls.length === 0) {
      newSteps.push({
        agent: 'planner',
        action: 'response',
        content: content?.substring(0, 200),
      });

      return {
        messages: newMessages,
        finalResponse: content,
        currentAgent: 'planner',
        agentSteps: newSteps,
        iterations: state.iterations + 1,
      };
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
        onProgress({ type: 'route', from: 'planner', to: targetAgent, task });

        newSteps.push({
          agent: 'planner',
          action: 'route',
          target: targetAgent,
          task,
        });

        newMessages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify({ routed: true, agent: targetAgent }),
        });

        newMessages.push({
          role: 'user',
          content: `[Delegated task]: ${task}`,
        });

        return {
          messages: [
            { role: 'user', content: state.query },
            ...newMessages,
          ],
          finalResponse: '',
          currentAgent: targetAgent,
          agentSteps: newSteps,
          iterations: state.iterations + 1,
        };
      }

      onProgress({ type: 'tool_call', agent: 'planner', tool: toolName, args });
      const result = await this.toolExecutor.execute(
        toolName,
        args,
        state.userId,
        (msg) => {
          onProgress({ type: 'tool_progress', agent: 'planner', message: msg });
        },
        state.role,
      );
      onProgress({
        type: 'tool_result',
        agent: 'planner',
        tool: toolName,
        result: JSON.stringify(result).substring(0, 200),
      });

      newSteps.push({
        agent: 'planner',
        action: 'tool_call',
        tool: toolName,
        args,
        resultSummary: JSON.stringify(result).substring(0, 100),
      });

      newMessages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: JSON.stringify(result),
      });
    }

    return {
      messages: newMessages,
      finalResponse: content || '',
      currentAgent: 'planner',
      agentSteps: newSteps,
      iterations: state.iterations + 1,
    };
  }

  private specialistNode(agentType: string) {
    return async function (
      this: AgentGraph,
      state: AgentState,
      config?: any,
    ): Promise<Partial<AgentState>> {
      const onProgress: ProgressEmitter =
        config?.configurable?.onProgress || (() => {});
      const agentConfig = AGENT_CONFIGS[agentType];
      const maxLoops = 5;

      onProgress({
        type: 'agent_start',
        agent: agentType,
        message: `${agentConfig.name} Agent working...`,
      });

      const currentMessages = [
        { role: 'system', content: agentConfig.systemPrompt },
        ...this.sanitizeForApi(state.messages, agentConfig.tools),
      ];

      const allNewMessages: any[] = [];
      const allNewSteps: any[] = [];
      let finalContent = '';

      for (let loop = 0; loop < maxLoops; loop++) {
        const stream = (await this.glm.chat.completions.create({
          model: this.model,
          messages: this.sanitizeForApi(currentMessages, agentConfig.tools) as any,
          tools: agentConfig.tools as any,
          tool_choice: 'auto',
          max_tokens: 4096,
          stream: true,
        } as any)) as any;

        let reasoning = '';
        let content = '';
        const toolCalls: any[] = [];

        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta;
          if (!delta) continue;

          if (delta.reasoning_content) {
            reasoning += delta.reasoning_content;
            onProgress({
              type: 'reasoning',
              agent: agentType,
              chunk: delta.reasoning_content,
            });
          }

          if (delta.content) {
            content += delta.content;
            onProgress({
              type: 'content',
              agent: agentType,
              chunk: delta.content,
            });
          }

          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0;
              if (!toolCalls[idx]) {
                toolCalls[idx] = {
                  id: tc.id || '',
                  function: { name: '', arguments: '' },
                };
              }
              if (tc.function?.name)
                toolCalls[idx].function.name += tc.function.name;
              if (tc.function?.arguments)
                toolCalls[idx].function.arguments += tc.function.arguments;
              if (tc.id) toolCalls[idx].id = tc.id;
            }
          }
        }

        const validToolCalls = toolCalls.filter((tc) => tc.id);

        const assistantMsg: any = {
          role: 'assistant',
          content: content || null,
        };
        if (validToolCalls.length > 0) {
          assistantMsg.tool_calls = validToolCalls.map((tc) => ({
            id: tc.id,
            type: 'function',
            function: tc.function,
          }));
        }

        allNewMessages.push(assistantMsg);
        currentMessages.push(assistantMsg);

        if (validToolCalls.length === 0) {
          finalContent = content;
          allNewSteps.push({
            agent: agentType,
            action: 'response',
            content: content?.substring(0, 200),
          });
          break;
        }

        for (const tc of validToolCalls) {
          const toolName = tc.function.name;
          let args: any = {};
          try {
            args = JSON.parse(tc.function.arguments || '{}');
          } catch {}

          onProgress({
            type: 'tool_call',
            agent: agentType,
            tool: toolName,
            args,
          });

          const result = await this.toolExecutor.execute(
            toolName,
            args,
            state.userId,
            (msg) => {
              onProgress({
                type: 'tool_progress',
                agent: agentType,
                message: msg,
              });
            },
            state.role,
          );

          onProgress({
            type: 'tool_result',
            agent: agentType,
            tool: toolName,
            result: JSON.stringify(result).substring(0, 200),
          });

          allNewSteps.push({
            agent: agentType,
            action: 'tool_call',
            tool: toolName,
            args,
            resultSummary: JSON.stringify(result).substring(0, 100),
          });

          const toolMsg = {
            role: 'tool' as const,
            tool_call_id: tc.id,
            content: JSON.stringify(result),
          };
          allNewMessages.push(toolMsg);
          currentMessages.push(toolMsg);
        }

        if (loop === maxLoops - 1) {
          finalContent = content;
          break;
        }
      }

      return {
        messages: allNewMessages,
        finalResponse: '',
        currentAgent: 'planner',
        agentSteps: allNewSteps,
        iterations: state.iterations + 1,
      };
    };
  }

  async run(
    query: string,
    userId: string,
    role: string,
    onProgress: ProgressEmitter,
  ): Promise<{ response: string; agentSteps: any[] }> {
    const initialState = {
      messages: [],
      query,
      userId,
      role,
      currentAgent: 'planner',
      finalResponse: '',
      agentSteps: [],
      iterations: 0,
    };

    try {
      const result = await this.compiledGraph.invoke(initialState, {
        configurable: { onProgress },
        recursionLimit: 20,
      });

      const finalResponse = result.finalResponse || '';
      if (!finalResponse && result.messages?.length > 0) {
        const lastAssistant = [...result.messages]
          .reverse()
          .find((m) => m.role === 'assistant' && m.content);
        return {
          response:
            lastAssistant?.content || 'I was unable to complete your request.',
          agentSteps: result.agentSteps || [],
        };
      }

      return {
        response: finalResponse,
        agentSteps: result.agentSteps || [],
      };
    } catch (error) {
      this.logger.error(`LangGraph orchestration failed: ${error.message}`);
      this.logger.error(error.stack);

      try {
        const result = await this.runDirect(query, userId, role, onProgress);
        return result;
      } catch (fallbackError) {
        this.logger.error(`Fallback also failed: ${fallbackError.message}`);
        return {
          response:
            'I encountered an error processing your request. Please try again.',
          agentSteps: [
            { agent: 'system', action: 'error', error: error.message },
          ],
        };
      }
    }
  }

  private async runDirect(
    query: string,
    userId: string,
    role: string,
    onProgress: ProgressEmitter,
  ): Promise<{ response: string; agentSteps: any[] }> {
    const state: AgentState = {
      messages: [],
      query,
      userId,
      role,
      currentAgent: 'planner',
      finalResponse: '',
      agentSteps: [],
      iterations: 0,
    };

    state.messages.push({
      role: 'system',
      content: AGENT_CONFIGS.planner.systemPrompt,
    });
    state.messages.push({ role: 'user', content: query });

    onProgress({
      type: 'agent_start',
      agent: 'planner',
      message: 'Planner Agent analyzing your request...',
    });

    let iterations = 0;
    const MAX_ITERATIONS = 15;

    while (iterations < MAX_ITERATIONS) {
      iterations++;
      const agentConfig = AGENT_CONFIGS[state.currentAgent];

      if (state.currentAgent !== 'planner') {
        const sysIdx = state.messages.findIndex(
          (m) => m.role === 'system',
        );
        if (sysIdx !== -1) {
          state.messages[sysIdx] = {
            role: 'system',
            content: agentConfig.systemPrompt,
          };
        } else {
          state.messages.unshift({
            role: 'system',
            content: agentConfig.systemPrompt,
          });
        }
      }

      try {
        const completed = await this.runAgentTurn(
          state,
          agentConfig,
          onProgress,
        );
        if (completed) break;
      } catch (error) {
        this.logger.error(`Agent turn failed: ${error.message}`);
        onProgress({
          type: 'tool_error',
          agent: state.currentAgent,
          message: error.message,
        });
        state.finalResponse =
          'I encountered an error processing your request. Please try again.';
        break;
      }
    }

    if (!state.finalResponse && state.messages.length > 0) {
      const lastAssistant = [...state.messages]
        .reverse()
        .find((m) => m.role === 'assistant' && m.content);
      state.finalResponse =
        lastAssistant?.content || 'I was unable to complete your request.';
    }

    return { response: state.finalResponse, agentSteps: state.agentSteps };
  }

  private async runAgentTurn(
    state: AgentState,
    agentConfig: any,
    onProgress: ProgressEmitter,
  ): Promise<boolean> {
    const stream = (await this.glm.chat.completions.create({
      model: this.model,
      messages: this.sanitizeForApi(state.messages, agentConfig.tools) as any,
      tools: agentConfig.tools,
      tool_choice: 'auto',
      max_tokens: 4096,
      stream: true,
    } as any)) as any;

    let reasoning = '';
    let content = '';
    const toolCalls: any[] = [];

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (!delta) continue;

      if (delta.reasoning_content) {
        reasoning += delta.reasoning_content;
        onProgress({
          type: 'reasoning',
          agent: state.currentAgent,
          chunk: delta.reasoning_content,
        });
      }

      if (delta.content) {
        content += delta.content;
        onProgress({
          type: 'content',
          agent: state.currentAgent,
          chunk: delta.content,
        });
      }

      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0;
          if (!toolCalls[idx]) {
            toolCalls[idx] = {
              id: tc.id || '',
              function: { name: '', arguments: '' },
            };
          }
          if (tc.function?.name)
            toolCalls[idx].function.name += tc.function.name;
          if (tc.function?.arguments)
            toolCalls[idx].function.arguments += tc.function.arguments;
          if (tc.id) toolCalls[idx].id = tc.id;
        }
      }
    }

    const validToolCalls = toolCalls.filter((tc) => tc.id);

    const assistantMsg: any = { role: 'assistant', content: content || null };
    if (reasoning) assistantMsg.reasoning_content = reasoning;
    if (validToolCalls.length > 0) {
      assistantMsg.tool_calls = validToolCalls.map((tc) => ({
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
        onProgress({
          type: 'route',
          from: state.currentAgent,
          to: targetAgent,
          task,
        });

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

      onProgress({
        type: 'tool_call',
        agent: state.currentAgent,
        tool: toolName,
        args,
      });

      const result = await this.toolExecutor.execute(
        toolName,
        args,
        state.userId,
        (msg) => {
          onProgress({
            type: 'tool_progress',
            agent: state.currentAgent,
            message: msg,
          });
        },
        state.role,
      );

      onProgress({
        type: 'tool_result',
        agent: state.currentAgent,
        tool: toolName,
        result: JSON.stringify(result).substring(0, 200),
      });

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
        content:
          'The specialist agent has completed its work. Please synthesize the results and provide a clear response to the user.',
      });
    }

    return false;
  }
}
