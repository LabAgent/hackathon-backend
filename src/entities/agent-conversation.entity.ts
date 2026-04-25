import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { AgentMessage } from './agent-message.entity';

@Entity('agent_conversations')
export class AgentConversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  title: string;

  @Column({ name: 'user_id' })
  userId: string;

  @OneToMany(() => AgentMessage, (message) => message.conversation, {
    cascade: true,
  })
  messages: AgentMessage[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
