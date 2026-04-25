import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('ai_actions_log')
export class AiActionLog {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @Column({ name: 'action_type', nullable: true })
  actionType: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
