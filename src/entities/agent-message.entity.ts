import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { AgentConversation } from './agent-conversation.entity';

export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  TOOL = 'tool',
  SYSTEM = 'system',
}

@Entity('agent_messages')
export class AgentMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  conversationId: string;

  @ManyToOne(() => AgentConversation, (conv) => conv.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation: AgentConversation;

  @Column({ type: 'enum', enum: MessageRole })
  role: MessageRole;

  @Column({ type: 'text', nullable: true })
  content: string;

  @Column({ type: 'text', nullable: true })
  reasoning: string;

  @Column({ type: 'jsonb', nullable: true })
  toolCalls: Record<string, any>[];

  @Column({ type: 'varchar', length: 50, nullable: true })
  agentName: string;

  @Column({ type: 'varchar', nullable: true, name: 'tool_call_id' })
  toolCallId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
