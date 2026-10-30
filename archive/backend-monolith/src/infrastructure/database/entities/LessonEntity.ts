import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { CourseModuleEntity } from './CourseModuleEntity.js';

export enum LessonContentType {
  TEXT = 'TEXT',
  VIDEO = 'VIDEO',
  PRESENTATION = 'PRESENTATION',
  GUIDE = 'GUIDE',
}

@Entity('lessons')
export class LessonEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  module_id: string;

  @ManyToOne(() => CourseModuleEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'module_id' })
  module?: CourseModuleEntity;

  @Column()
  title: string;

  @Column({
    type: 'enum',
    enum: LessonContentType,
    default: LessonContentType.TEXT,
  })
  content_type: LessonContentType;

  @Column({ type: 'text', default: '' })
  content_text: string;

  @Column({ type: 'text', nullable: true })
  file_url?: string; // S3 link

  @Column({ type: 'int', default: 0 })
  order_index: number;
}
