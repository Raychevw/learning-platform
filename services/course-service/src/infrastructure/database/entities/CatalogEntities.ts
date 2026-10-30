import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { CourseEntity } from './CourseEntity.js';

@Entity('course_modules')
export class CourseModuleEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Index()
  @Column({ type: 'varchar', length: 64 })
  courseId!: string;

  @ManyToOne(() => CourseEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'courseId' })
  course?: CourseEntity;

  @Column({ length: 255 })
  title!: string;

  @Column({ type: 'int', default: 0 })
  orderIndex!: number;
}

@Entity('lessons')
export class LessonEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Index()
  @Column({ type: 'varchar', length: 64 })
  moduleId!: string;

  @ManyToOne(() => CourseModuleEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'moduleId' })
  module?: CourseModuleEntity;

  @Column({ length: 255 })
  title!: string;

  /** Лекція | Методичка | Відео | Презентація */
  @Column({ length: 64, default: 'Лекція' })
  type!: string;

  @Column({ type: 'text', default: '' })
  content!: string;

  /** Зовнішнє посилання або відео (YouTube/Drive тощо). */
  @Column({ name: 'link_url', length: 512, default: '' })
  linkUrl!: string;

  @Column({ name: 'video_url', length: 512, default: '' })
  videoUrl!: string;

  /** Завантажений файл матеріалу (PDF/Word/PPT/відео). */
  @Column({ name: 'file_key', type: 'varchar', length: 512, nullable: true })
  fileKey!: string | null;

  @Column({ name: 'file_name', length: 255, default: '' })
  fileName!: string;

  @Column({ name: 'file_size', length: 32, default: '' })
  fileSize!: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 128, nullable: true })
  mimeType!: string | null;

  @Column({ type: 'int', default: 0 })
  orderIndex!: number;
}

@Entity('lesson_completions')
export class LessonCompletionEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  lessonId!: string;

  @PrimaryColumn({ type: 'varchar', length: 64 })
  userId!: string;

  @ManyToOne(() => LessonEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lessonId' })
  lesson?: LessonEntity;

  @Column({ type: 'timestamp with time zone', default: () => 'now()' })
  completedAt!: Date;
}

export interface WebinarChatMessage {
  id: string;
  senderName: string;
  senderRole: string;
  text: string;
  time: string;
}

@Entity('webinars')
export class WebinarEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Index()
  @Column({ type: 'varchar', length: 64 })
  courseId!: string;

  @ManyToOne(() => CourseEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'courseId' })
  course?: CourseEntity;

  @Column({ length: 255 })
  title!: string;

  @Column({ length: 255, default: '' })
  instructor!: string;

  @Column({ type: 'timestamp with time zone' })
  scheduledAt!: Date;

  /** SCHEDULED | LIVE | FINISHED */
  @Column({ length: 32, default: 'SCHEDULED' })
  status!: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  chat!: WebinarChatMessage[];
}

/** Розклад занять: одна пара (лекція/практика/лабораторна) для групи. */
@Entity('schedule_entries')
@Index(['groupId', 'weekday', 'startTime'])
export class ScheduleEntryEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Index()
  @Column({ type: 'varchar', length: 64 })
  courseId!: string;

  @ManyToOne(() => CourseEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'courseId' })
  course?: CourseEntity;

  @Column({ type: 'varchar', length: 64 })
  groupId!: string;

  /** 1 = понеділок ... 7 = неділя */
  @Column({ type: 'int' })
  weekday!: number;

  @Column({ type: 'varchar', length: 5 })
  startTime!: string;

  @Column({ type: 'varchar', length: 5 })
  endTime!: string;

  @Column({ type: 'varchar', length: 64, default: '' })
  room!: string;

  /** Лекція | Практика | Лабораторна */
  @Column({ type: 'varchar', length: 32, default: 'Лекція' })
  lessonType!: string;

  @Column({ type: 'varchar', length: 255, default: '' })
  teacherName!: string;

  @Column({ type: 'varchar', length: 512, default: '' })
  onlineUrl!: string;

  @Column({ type: 'timestamp with time zone', default: () => 'now()' })
  createdAt!: Date;
}
