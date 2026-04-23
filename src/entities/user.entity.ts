import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true, length: 255 })
  email: string;

  @Column({ type: 'varchar', name: 'password_hash', length: 255 })
  passwordHash: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role: UserRole;

  @Column({ type: 'varchar', name: 'full_name', length: 255 })
  fullName: string;

  @Column({ type: 'varchar', nullable: true, length: 500 })
  image: string;

  @Column({ type: 'boolean', name: 'mfa_enabled', default: false })
  mfaEnabled: boolean;

  @Column({ type: 'varchar', name: 'mfa_secret', nullable: true, length: 255 })
  mfaSecret: string;

  @Column({ type: 'jsonb', name: 'mfa_backup_codes', nullable: true })
  mfaBackupCodes: string[];

  @Column({ type: 'integer', name: 'failed_attempts', default: 0 })
  failedAttempts: number;

  @Column({ type: 'timestamp', name: 'locked_until', nullable: true })
  lockedUntil: Date;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', name: 'is_verified', default: false })
  isVerified: boolean;

  @Column({ type: 'timestamp', name: 'last_login', nullable: true })
  lastLogin: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}