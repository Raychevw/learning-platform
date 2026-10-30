import { Entity, Column, PrimaryColumn } from 'typeorm';

export interface RubricCriterion {
  id: string;
  name: string;
  max: number;
}

@Entity('assignments')
export class AssignmentEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ type: 'varchar', length: 64 })
  courseId!: string;

  @Column({ length: 255, default: 'Untitled Course' })
  courseTitle!: string;

  @Column({ length: 255 })
  title!: string;

  @Column('int')
  maxScore!: number;

  @Column({ name: 'open_at', type: 'timestamp with time zone', nullable: true })
  openAt!: Date | null;

  @Column('timestamp with time zone')
  dueDate!: Date;

  /** Дозволені формати файлу відповіді: pdf, docx, zip, pptx... */
  @Column({ name: 'allowed_formats', type: 'jsonb', default: () => "'[\"pdf\",\"docx\"]'" })
  allowedFormats!: string[];

  @Column({ default: true })
  isCourseVerified!: boolean;

  // Coursework details (managed by CourseworkService, ignored by the Assignment aggregate)
  @Column({ type: 'text', default: '' })
  description!: string;

  /** Лабораторна | Практична | Тест | Курсова */
  @Column({ length: 64, default: 'Лабораторна' })
  type!: string;

  @Column({ length: 255, default: '' })
  rubricTitle!: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  criteria!: RubricCriterion[];

  @Column({ type: 'timestamp with time zone', default: () => 'now()' })
  createdAt!: Date;
}
