import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { Project } from '../../../entities/project.entity';
import { Inventory } from '../../../entities/inventory.entity';
import { ExperimentsLog } from '../../../entities/experiments-log.entity';
import { AiActionLog } from '../../../entities/ai-action-log.entity';
import { ResearchCache } from '../../../entities/research-cache.entity';
import { InventoryTransaction } from '../../../entities/inventory-transaction.entity';
import { AgentTask } from '../../../entities/agent-task.entity';

@Injectable()
export class ToolExecutor {
  private readonly logger = new Logger(ToolExecutor.name);
  private tavilyClient: any = null;

  constructor(
    @InjectRepository(Project)
    private projectRepo: Repository<Project>,
    @InjectRepository(Inventory)
    private inventoryRepo: Repository<Inventory>,
    @InjectRepository(ExperimentsLog)
    private experimentLogRepo: Repository<ExperimentsLog>,
    @InjectRepository(AiActionLog)
    private aiActionLogRepo: Repository<AiActionLog>,
    @InjectRepository(ResearchCache)
    private researchCacheRepo: Repository<ResearchCache>,
    @InjectRepository(InventoryTransaction)
    private transactionRepo: Repository<InventoryTransaction>,
    @InjectRepository(AgentTask)
    private agentTaskRepo: Repository<AgentTask>,
    private httpService: HttpService,
    private configService: ConfigService,
  ) {
    const tavilyKey = this.configService.get('TAVILY_API_KEY');
    if (tavilyKey) {
      try {
        const { tavily } = require('@tavily/core');
        this.tavilyClient = tavily({ apiKey: tavilyKey });
        this.logger.log('Tavily web search initialized successfully');
      } catch (err) {
        this.logger.warn(`Tavily init failed, falling back to LLM search: ${err.message}`);
      }
    }
  }

  async execute(
    toolName: string,
    args: Record<string, any>,
    userId: string,
    onProgress: (msg: string) => void,
  ): Promise<any> {
    this.logger.log(`Executing tool: ${toolName}`);
    try {
      switch (toolName) {
        case 'web_search':
          return await this.webSearch(args, onProgress);
        case 'create_experiment_log':
          return await this.createExperimentLog(args, onProgress);
        case 'suggest_hypothesis':
          return await this.suggestHypothesis(args, onProgress);
        case 'analyze_findings':
          return await this.analyzeFindings(args, onProgress);
        case 'check_stock':
          return await this.checkStock(args, onProgress);
        case 'update_stock':
          return await this.updateStock(args, onProgress);
        case 'alert_low_stock':
          return await this.alertLowStock(onProgress);
        case 'suggest_reorder':
          return await this.suggestReorder(args, onProgress);
        case 'query_records':
          return await this.queryRecords(args, onProgress);
        case 'create_record':
          return await this.createRecord(args, onProgress);
        case 'update_record':
          return await this.updateRecord(args, onProgress);
        case 'delete_record':
          return await this.deleteRecord(args, onProgress);
        default:
          return { error: `Unknown tool: ${toolName}` };
      }
    } catch (error) {
      this.logger.error(`Tool ${toolName} failed: ${error.message}`);
      onProgress(`Error in ${toolName}: ${error.message}`);
      await this.logAiAction(toolName, args, { error: error.message });
      return { error: true, message: error.message };
    }
  }

  private async logAiAction(actionType: string, input: any, output: any) {
    try {
      await this.aiActionLogRepo.save({
        actionType,
        description: `${actionType} executed`,
        metadata: { input, output },
      });
    } catch {}
  }

  private async webSearch(args: any, onProgress: (msg: string) => void) {
    onProgress(`Searching web: "${args.query}"`);
    const count = args.count || 5;

    if (this.tavilyClient) {
      try {
        const response = await this.tavilyClient.search(args.query, {
          maxResults: count,
          searchDepth: 'advanced',
          includeAnswer: true,
        });

        const results = (response.results || []).map((r: any) => ({
          title: r.title || 'Untitled',
          content: r.content?.substring(0, 500) || '',
          link: r.url || '',
          media: '',
        }));

        const answer = response.answer || '';

        await this.researchCacheRepo.save({
          topic: args.query,
          summary: (answer || results.map(r => r.content).join('\n')).substring(0, 500),
          source: 'tavily_search',
        });

        await this.logAiAction('web_search', { query: args.query }, { source: 'tavily', count: results.length });

        onProgress(`Found ${results.length} web results via Tavily`);

        return {
          results,
          answer,
          source: 'Tavily web search',
        };
      } catch (error) {
        this.logger.warn(`Tavily search failed: ${error.message}, falling back to LLM search`);
      }
    }

    onProgress('Tavily unavailable, using LLM-assisted search...');
    const apiKey = this.configService.get('OPENROUTER_API_KEY');
    const model = this.configService.get('AI_MODEL', 'openai/gpt-4o-mini');

    try {
      const response = await firstValueFrom(
        this.httpService.post<any>(
          'https://openrouter.ai/api/v1/chat/completions',
          {
            model,
            messages: [
              { role: 'system', content: 'You are a research assistant. Provide factual, detailed information about the given topic. Include specific data, studies, and references where possible. Format your response as a list of findings.' },
              { role: 'user', content: `Provide detailed research information about: ${args.query}. Include relevant facts, studies, and data.` },
            ],
            max_tokens: 800,
          },
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      const content = response.data?.choices?.[0]?.message?.content || 'No results found';

      await this.researchCacheRepo.save({
        topic: args.query,
        summary: content.substring(0, 500),
        source: 'llm_search',
      });

      await this.logAiAction('web_search', { query: args.query }, { source: 'llm', length: content.length });

      onProgress('Found research information via LLM');

      return {
        results: [{
          title: `Research: ${args.query}`,
          content: content.substring(0, 500),
          link: '',
          media: '',
        }],
        source: 'LLM-assisted research (Tavily unavailable)',
      };
    } catch (error) {
      this.logger.warn(`LLM search also failed: ${error.message}`);
      onProgress('Search failed, checking cached data...');

      const cached = await this.researchCacheRepo
        .createQueryBuilder('c')
        .where('c.topic ILIKE :topic', { topic: `%${args.query}%` })
        .orderBy('c.created_at', 'DESC')
        .limit(3)
        .getMany();

      if (cached.length > 0) {
        await this.logAiAction('web_search', { query: args.query }, { source: 'cache', count: cached.length });
        return {
          results: cached.map(c => ({
            title: `Cached: ${c.topic}`,
            content: c.summary?.substring(0, 500) || '',
            link: '',
            media: '',
          })),
          source: 'cached research data',
        };
      }

      await this.logAiAction('web_search', { query: args.query }, { source: 'none' });
      return {
        results: [{ title: 'No results', content: 'Search is currently unavailable. Please try again later.', link: '', media: '' }],
        source: 'fallback',
      };
    }
  }

  private async createExperimentLog(args: any, onProgress: (msg: string) => void) {
    onProgress(`Creating experiment log for project: ${args.projectId}`);
    const project = await this.projectRepo.findOne({ where: { id: args.projectId } });
    if (!project) return { error: true, message: 'Project not found' };
    const log = this.experimentLogRepo.create({
      projectId: args.projectId,
      result: args.result,
      success: args.success,
      notes: args.notes,
      hypothesis: args.hypothesis,
      methodology: args.methodology,
      status: args.status || 'planned',
    });
    await this.experimentLogRepo.save(log);
    onProgress(`Experiment log created: ${log.id}`);
    await this.logAiAction('create_experiment_log', args, { id: log.id });
    return { id: log.id, projectId: log.projectId, success: log.success, status: log.status };
  }

  private async suggestHypothesis(args: any, onProgress: (msg: string) => void) {
    onProgress('Generating hypotheses...');

    const cached = await this.researchCacheRepo
      .createQueryBuilder('c')
      .where('c.topic ILIKE :topic', { topic: `%${args.topic}%` })
      .orderBy('c.created_at', 'DESC')
      .limit(3)
      .getMany();

    const cachedContext = cached.length > 0
      ? cached.map(c => c.summary?.substring(0, 300)).join('\n')
      : '';

    try {
      const apiKey = this.configService.get('OPENROUTER_API_KEY');
      const model = this.configService.get('AI_MODEL', 'openai/gpt-4o-mini');
      const prompt = `You are Sandy Cheeks' Research Agent. Generate 3 specific, testable scientific hypotheses about the topic: "${args.topic}".
${cachedContext ? `Relevant research context:\n${cachedContext}\n` : ''}
${args.existingData ? `Existing data:\n${args.existingData}\n` : ''}
Format each hypothesis as a clear, falsifiable statement. Be specific and creative.`;

      const response = await firstValueFrom(
        this.httpService.post<any>(
          'https://openrouter.ai/api/v1/chat/completions',
          {
            model,
            messages: [
              { role: 'system', content: 'You are a scientific hypothesis generator. Always respond with exactly 3 numbered hypotheses.' },
              { role: 'user', content: prompt },
            ],
            max_tokens: 500,
          },
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      const rawHypotheses = response.data?.choices?.[0]?.message?.content || '';
      const hypotheses = rawHypotheses
        .split('\n')
        .filter((line: string) => line.trim().match(/^\d/) || line.trim().startsWith('-') || line.trim().startsWith('•'))
        .map((line: string) => line.replace(/^[\d\.\-•]+\s*/, '').trim())
        .filter((h: string) => h.length > 20);

      if (hypotheses.length === 0) {
        hypotheses.push(
          `Based on "${args.topic}", hypothesis 1: The primary variable shows a positive correlation with the outcome measure.`,
          `Hypothesis 2: Environmental factors significantly influence the observed patterns in ${args.topic}.`,
          `Hypothesis 3: A non-linear relationship exists between the key variables in this domain.`,
        );
      }

      await this.logAiAction('suggest_hypothesis', { topic: args.topic }, { cached: !!cached.length, generated: true });

      return {
        topic: args.topic,
        hypotheses: hypotheses.slice(0, 3),
        note: 'These hypotheses were AI-generated and should be validated through controlled experiments.',
      };
    } catch (error) {
      this.logger.warn(`Hypothesis generation failed, using fallback: ${error.message}`);
      await this.logAiAction('suggest_hypothesis', { topic: args.topic }, { cached: !!cached.length, fallback: true });
      return {
        topic: args.topic,
        hypotheses: [
          `Based on "${args.topic}", hypothesis 1: The primary variable shows a positive correlation with the outcome measure.${cachedContext ? ` (Context: ${cachedContext.substring(0, 100)})` : ''}`,
          `Hypothesis 2: Environmental factors significantly influence the observed patterns in ${args.topic}.`,
          `Hypothesis 3: A non-linear relationship exists between the key variables in this domain.`,
        ],
        note: 'These are fallback hypotheses. AI generation was unavailable.',
      };
    }
  }

  private async analyzeFindings(args: any, onProgress: (msg: string) => void) {
    onProgress(`Analyzing findings for project: ${args.projectId}`);
    const project = await this.projectRepo.findOne({
      where: { id: args.projectId },
      relations: ['experiments'],
    });
    if (!project) return { error: true, message: 'Project not found' };

    const experiments = project.experiments || [];
    await this.logAiAction('analyze_findings', { projectId: args.projectId }, { experimentCount: experiments.length });

    return {
      projectName: project.name,
      projectStatus: project.status,
      totalExperiments: experiments.length,
      successfulExperiments: experiments.filter(e => e.success === true).length,
      question: args.question || 'General analysis',
      analysis: `Project "${project.name}" (status: ${project.status}) has ${experiments.length} experiments, ${experiments.filter(e => e.success === true).length} successful.`,
      experiments: experiments.map(e => ({
        id: e.id,
        result: e.result,
        success: e.success,
        notes: e.notes,
      })),
    };
  }

  private async checkStock(args: any, onProgress: (msg: string) => void) {
    onProgress('Checking inventory stock...');
    const query = this.inventoryRepo.createQueryBuilder('item');
    if (args.itemName) query.andWhere('item.name ILIKE :name', { name: `%${args.itemName}%` });
    if (args.category) query.andWhere('item.category = :cat', { cat: args.category });
    if (args.lowStockOnly) query.andWhere('item.quantity <= item.min_required');
    const items = await query.orderBy('item.name', 'ASC').getMany();
    onProgress(`Found ${items.length} items`);
    return {
      items: items.map(i => ({
        id: i.id,
        name: i.name,
        category: i.category,
        quantity: i.quantity,
        unit: i.unit,
        minRequired: i.minRequired,
        status: i.quantity <= i.minRequired ? 'LOW' : 'OK',
      })),
    };
  }

  private async updateStock(args: any, onProgress: (msg: string) => void) {
    onProgress(`Updating stock for item: ${args.itemId}`);
    const item = await this.inventoryRepo.findOne({ where: { id: args.itemId } });
    if (!item) return { error: true, message: 'Item not found' };
    const oldQty = item.quantity;
    const changeAmount = args.newQuantity - oldQty;
    item.quantity = args.newQuantity;
    item.lastUpdated = new Date();
    await this.inventoryRepo.save(item);

    await this.transactionRepo.save({
      inventoryId: item.id,
      changeAmount,
      reason: args.reason || 'Agent update',
    });

    onProgress(`Stock updated: ${oldQty} → ${args.newQuantity}`);
    await this.logAiAction('update_stock', { itemId: args.itemId, oldQty, newQty: args.newQuantity }, { changeAmount });
    return {
      success: true,
      itemName: item.name,
      previousQuantity: oldQty,
      newQuantity: args.newQuantity,
      reason: args.reason || 'Agent update',
    };
  }

  private async alertLowStock(onProgress: (msg: string) => void) {
    onProgress('Checking for low stock alerts...');
    const items = await this.inventoryRepo
      .createQueryBuilder('item')
      .where('item.quantity <= item.min_required')
      .orderBy('item.quantity', 'ASC')
      .getMany();
    onProgress(`Found ${items.length} low stock items`);
    return {
      alertCount: items.length,
      alerts: items.map(i => ({
        id: i.id,
        name: i.name,
        category: i.category,
        quantity: i.quantity,
        minRequired: i.minRequired,
        deficit: i.minRequired - i.quantity,
      })),
    };
  }

  private async suggestReorder(args: any, onProgress: (msg: string) => void) {
    onProgress('Analyzing reorder needs...');
    const lowStockItems = await this.inventoryRepo
      .createQueryBuilder('item')
      .where('item.quantity <= item.min_required')
      .getMany();

    return {
      suggestions: lowStockItems.map(item => ({
        itemId: item.id,
        name: item.name,
        currentQuantity: item.quantity,
        suggestedOrder: item.minRequired * 3,
        reason: `Current stock (${item.quantity}) is below threshold (${item.minRequired})`,
      })),
    };
  }

  private async queryRecords(args: any, onProgress: (msg: string) => void) {
    const { table, filters, limit = 20 } = args;
    onProgress(`Querying ${table}...`);
    const repo = this.getRepository(table);
    if (!repo) return { error: true, message: `Table "${table}" not accessible` };
    const qb = repo.createQueryBuilder('t');
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        qb.andWhere(`t.${key} = :${key}`, { [key]: value });
      });
    }
    qb.limit(Math.min(limit, 50));
    const records = await qb.getMany();
    onProgress(`Found ${records.length} records`);
    await this.logAiAction('query_records', { table, filters }, { count: records.length });
    return { records, count: records.length };
  }

  private async createRecord(args: any, onProgress: (msg: string) => void) {
    const { table, data } = args;
    onProgress(`Creating record in ${table}...`);
    const repo = this.getRepository(table);
    if (!repo) return { error: true, message: `Table "${table}" not accessible` };
    const record = repo.create(data);
    await repo.save(record);
    onProgress(`Record created: ${(record as any).id}`);
    await this.logAiAction('create_record', { table, data }, { id: (record as any).id });
    return { id: (record as any).id, created: true };
  }

  private async updateRecord(args: any, onProgress: (msg: string) => void) {
    const { table, id, data } = args;
    onProgress(`Updating record in ${table}...`);
    const repo = this.getRepository(table);
    if (!repo) return { error: true, message: `Table "${table}" not accessible` };
    await repo.update(id, data);
    onProgress('Record updated');
    await this.logAiAction('update_record', { table, id, data }, { updated: true });
    return { id, updated: true };
  }

  private async deleteRecord(args: any, onProgress: (msg: string) => void) {
    const { table, id } = args;
    onProgress(`Deleting record from ${table}...`);
    const repo = this.getRepository(table);
    if (!repo) return { error: true, message: `Table "${table}" not accessible` };
    await repo.delete(id);
    onProgress('Record deleted');
    await this.logAiAction('delete_record', { table, id }, { deleted: true });
    return { id, deleted: true };
  }

  private getRepository(table: string): Repository<any> | null {
    switch (table) {
      case 'projects': return this.projectRepo;
      case 'inventory': return this.inventoryRepo;
      case 'experiments_log': return this.experimentLogRepo;
      case 'ai_actions_log': return this.aiActionLogRepo;
      case 'research_cache': return this.researchCacheRepo;
      case 'inventory_transactions': return this.transactionRepo;
      case 'agent_tasks': return this.agentTaskRepo;
      default: return null;
    }
  }
}
