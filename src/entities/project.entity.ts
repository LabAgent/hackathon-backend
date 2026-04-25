import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { ProjectRequirement } from './project-requirement.entity';
import { ExperimentsLog } from './experiments-log.entity';

export enum ProjectStatus {
  PLANNED = 'planned',
  ONGOING = 'ongoing',
  COMPLETED = 'completed',
}

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'text', default: 'planned' })
  status: string;

  @Column({ type: 'integer', default: 1 })
  priority: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => ProjectRequirement, (pr) => pr.project)
  requirements: ProjectRequirement[];

  @OneToMany(() => ExperimentsLog, (el) => el.project)
  experiments: ExperimentsLog[];
}
