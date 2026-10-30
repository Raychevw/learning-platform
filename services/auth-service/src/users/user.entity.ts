import { Entity, PrimaryColumn, Column, CreateDateColumn, Index } from 'typeorm';
import { UserRole } from './roles.js';

export { UserRole };

@Entity('users')
export class UserEntity {
  // Строковый PK (как и во всех сервисах платформы: 'usr-student', 'c-1', ...),
  // поэтому demo-аккаунты сохраняют совместимость с seed-данными курсов и заданий.
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64, nullable: true })
  username: string | null;

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({ name: 'full_name', type: 'varchar', length: 255 })
  fullName: string;

  @Column({ type: 'varchar', length: 16, default: UserRole.STUDENT })
  role: UserRole;

  @Column({ name: 'department', type: 'varchar', length: 255, nullable: true })
  department: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  /** ACTIVE | EXPELLED | ACADEMIC_LEAVE */
  @Column({ type: 'varchar', length: 24, default: 'ACTIVE' })
  status: 'ACTIVE' | 'EXPELLED' | 'ACADEMIC_LEAVE';

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;
}

export interface PublicUser {
  id: string;
  email: string;
  username: string | null;
  fullName: string;
  role: UserRole;
  department: string | null;
  status: 'ACTIVE' | 'EXPELLED' | 'ACADEMIC_LEAVE';
}

export function toPublicUser(user: UserEntity): PublicUser {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    department: user.department,
    status: user.status || 'ACTIVE',
  };
}
