import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum AuditStatus {
  ALLOWED = 'ALLOWED',
  DENIED = 'DENIED',
}

@Entity('audit_logs')
export class AuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  user_id?: string;

  @Column({ type: 'varchar', length: 64, default: '127.0.0.1' })
  ip_address: string;

  @Column()
  action: string;

  @Column()
  target_resource: string;

  @Column({
    type: 'enum',
    enum: AuditStatus,
    default: AuditStatus.ALLOWED,
  })
  status: AuditStatus;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;
}
