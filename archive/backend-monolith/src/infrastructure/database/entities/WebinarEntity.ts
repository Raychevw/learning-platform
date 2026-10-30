import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { CourseEntity } from './CourseEntity.js';

export enum WebinarStatus {
  SCHEDULED = 'SCHEDULED',
  LIVE = 'LIVE',
  RECONNECTING = 'RECONNECTING',
  FINISHED = 'FINISHED',
}

export interface ChatMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  message: string;
  timestamp: string;
}

@Entity('webinars')
export class WebinarEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  course_id: string;

  @ManyToOne(() => CourseEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'course_id' })
  course?: CourseEntity;

  @Column()
  title: string;

  @Column({ type: 'timestamp with time zone' })
  scheduled_at: Date;

  @Column({ type: 'text', default: '' })
  meeting_url: string;

  @Column({
    type: 'enum',
    enum: WebinarStatus,
    default: WebinarStatus.SCHEDULED,
  })
  status: WebinarStatus;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  chat_history_json: ChatMessage[];
}
