import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ProjectRequirement } from './project-requirement.entity';
import { InventoryTransaction } from './inventory-transaction.entity';

@Entity('inventory')
export class Inventory {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text', nullable: true })
  category: string;

  @Column({ type: 'integer', default: 0 })
  quantity: number;

  @Column({ type: 'text', nullable: true })
  unit: string;

  @Column({ type: 'integer', name: 'min_required', default: 0 })
  minRequired: number;

  @Column({ type: 'text', nullable: true })
  location: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'timestamp',
    name: 'last_updated',
    default: () => 'CURRENT_TIMESTAMP',
  })
  lastUpdated: Date;

  @OneToMany(() => ProjectRequirement, (pr) => pr.inventory)
  requirements: ProjectRequirement[];

  @OneToMany(() => InventoryTransaction, (it) => it.inventory)
  transactions: InventoryTransaction[];
}
