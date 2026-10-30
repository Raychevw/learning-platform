import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('messages')
export class MessageEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Index()
  @Column({ name: 'sender_id', type: 'varchar', length: 64 })
  senderId!: string;

  @Column({ name: 'sender_name', type: 'varchar', length: 255, default: '' })
  senderName!: string;

  @Column({ name: 'sender_role', type: 'varchar', length: 16, default: '' })
  senderRole!: string;

  @Index()
  @Column({ name: 'recipient_id', type: 'varchar', length: 64 })
  recipientId!: string;

  @Column({ name: 'recipient_name', type: 'varchar', length: 255, default: '' })
  recipientName!: string;

  @Column({ type: 'varchar', length: 255, default: '' })
  subject!: string;

  @Column({ type: 'text' })
  body!: string;

  @Column({ name: 'course_id', type: 'varchar', length: 64, nullable: true })
  courseId!: string | null;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
