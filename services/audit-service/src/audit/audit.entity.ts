import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

export type AuditStatus = 'ALLOWED' | 'DENIED' | 'ERROR';

@Entity('audit_logs')
export class AuditLogEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Index()
  @Column({ name: 'user_id', type: 'varchar', length: 64, default: 'anonymous' })
  userId!: string;

  @Column({ name: 'user_role', type: 'varchar', length: 16, default: '' })
  userRole!: string;

  @Column({ name: 'user_name', type: 'varchar', length: 255, default: '' })
  userName!: string;

  @Column({ type: 'varchar', length: 128 })
  action!: string;

  @Column({ type: 'varchar', length: 255, default: '' })
  resource!: string;

  @Column({ type: 'varchar', length: 8, default: 'GET' })
  method!: string;

  @Column({ type: 'varchar', length: 512, default: '' })
  path!: string;

  @Column({ name: 'status_code', type: 'int', default: 0 })
  statusCode!: number;

  @Index()
  @Column({ type: 'varchar', length: 16, default: 'ALLOWED' })
  status!: AuditStatus;

  @Column({ type: 'varchar', length: 64, default: '' })
  ip!: string;

  @Column({ name: 'request_id', type: 'varchar', length: 64, default: '' })
  requestId!: string;

  @Index()
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
