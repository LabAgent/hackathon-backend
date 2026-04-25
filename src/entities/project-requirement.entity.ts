import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Project } from './project.entity';
import { Inventory } from './inventory.entity';

@Entity('project_requirements')
export class ProjectRequirement {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @Column({ name: 'project_id' })
  projectId: number;

  @Column({ name: 'inventory_id' })
  inventoryId: number;

  @Column({ name: 'required_quantity' })
  requiredQuantity: number;

  @ManyToOne(() => Project, (project) => project.requirements, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @ManyToOne(() => Inventory, (inventory) => inventory.requirements, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'inventory_id' })
  inventory: Inventory;
}
