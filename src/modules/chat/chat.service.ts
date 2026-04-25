import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subject, Observable } from 'rxjs';
import { AgentConversation } from '../../entities/agent-conversation.entity';
import { AgentMessage, MessageRole } from '../../entities/agent-message.entity';
import { AgentGraph } from '../agent/agent.graph';

export interface ProgressEvent {
  type: string;
  agent?: string;
  message?: string;
  chunk?: string;
  tool?: string;
  args?: any;
  result?: any;
  from?: string;
  to?: string;
  task?: string;
  data?: any;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly progressSubjects = new Map<string, Subject<ProgressEvent>>();

  constructor(
    @InjectRepository(AgentConversation)
    private conversationRepo: Repository<AgentConversation>,
    @InjectRepository(AgentMessage)
    private messageRepo: Repository<AgentMessage>,
    private agentGraph: AgentGraph,
  ) {}

  async createConversation(userId: string): Promise<AgentConversation> {
    const conversation = this.conversationRepo.create({ userId, title: 'New Conversation' });
    return this.conversationRepo.save(conversation);
  }

  async getConversations(userId: string): Promise<AgentConversation[]> {
    return this.conversationRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async getConversation(id: string, userId: string): Promise<AgentConversation> {
    const conv = await this.conversationRepo.findOne({
      where: { id, userId },
      relations: ['messages'],
    });
    if (!conv) throw new Error('Conversation not found');
    return conv;
  }

  async sendMessage(
    conversationId: string,
    userId: string,
    role: string,
    content: string,
  ): Promise<Observable<ProgressEvent>> {
    const subject = new Subject<ProgressEvent>();
    this.progressSubjects.set(conversationId, subject);

    const conversation = await this.conversationRepo.findOne({ where: { id: conversationId, userId } });
    if (!conversation) {
      subject.error(new Error('Conversation not found'));
      return subject.asObservable();
    }

    await this.saveMessage(conversationId, MessageRole.USER, content);

    if (!conversation.title || conversation.title === 'New Conversation') {
      conversation.title = content.substring(0, 50);
      await this.conversationRepo.save(conversation);
    }

    this.runAgent(conversationId, userId, role, content, subject).catch((err) => {
      this.logger.error(`Agent run failed: ${err.message}`);
      subject.next({ type: 'error', message: err.message });
      subject.complete();
      this.progressSubjects.delete(conversationId);
    });

    return subject.asObservable();
  }

  private async runAgent(
    conversationId: string,
    userId: string,
    role: string,
    query: string,
    subject: Subject<ProgressEvent>,
  ) {
    const onProgress = (event: ProgressEvent) => {
      subject.next(event);
    };

    try {
      const result = await this.agentGraph.run(query, userId, role, onProgress);

      await this.saveMessage(
        conversationId,
        MessageRole.ASSISTANT,
        result.response,
        null,
        result.agentSteps,
      );

      if (conversationId) {
        await this.conversationRepo.update(conversationId, {
          title: query.substring(0, 50),
        });
      }

      subject.next({ type: 'complete', data: result });
    } catch (error) {
      subject.next({ type: 'error', message: error.message });
    } finally {
      subject.complete();
      this.progressSubjects.delete(conversationId);
    }
  }

  private async saveMessage(
    conversationId: string,
    role: MessageRole,
    content: string,
    reasoning?: string | null,
    agentSteps?: any[] | null,
  ): Promise<AgentMessage> {
    const message = this.messageRepo.create({
      conversationId,
      role,
      content,
      reasoning: reasoning || undefined,
      agentName: role === MessageRole.ASSISTANT ? 'planner' : undefined,
      toolCalls: agentSteps || undefined,
    });
    return this.messageRepo.save(message);
  }
}
