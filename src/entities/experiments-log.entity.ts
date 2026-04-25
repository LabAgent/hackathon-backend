import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Project } from './project.entity';

export enum ExperimentStatus {
  PLANNED = 'planned',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

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

  @Column({ type: 'text', nullable: true })
  hypothesis: string;

  @Column({ type: 'text', nullable: true })
  methodology: string;

  @Column({ type: 'text', default: 'planned' })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Project, (project) => project.experiments, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'project_id' })
  project: Project;
}
