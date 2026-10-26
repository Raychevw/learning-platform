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

  @Column('timestamp with time zone')
  dueDate!: Date;

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
