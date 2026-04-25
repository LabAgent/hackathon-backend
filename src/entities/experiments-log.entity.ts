import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Project } from './project.entity';

@Entity('experiments_log')
export class ExperimentsLog {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @Column({ name: 'project_id', nullable: true })
  projectId: number;

  @Column({ type: 'text', nullable: true })
  result: string;

  @Column({ type: 'boolean', nullable: true })
  success: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Project, (project) => project.experiments, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'project_id' })
  project: Project;
}
