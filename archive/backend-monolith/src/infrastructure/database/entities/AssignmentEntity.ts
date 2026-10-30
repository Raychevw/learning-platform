import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { CourseModuleEntity } from './CourseModuleEntity.js';
import { RubricEntity } from './RubricEntity.js';

export enum AssignmentType {
  LAB = 'LAB',
  PRACTICAL = 'PRACTICAL',
  TEST = 'TEST',
  COURSEWORK = 'COURSEWORK',
}

@Entity('assignments')
export class AssignmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'module_id', type: 'uuid', nullable: true })
  module_id?: string;

  @ManyToOne(() => CourseModuleEntity, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'module_id' })
  module?: CourseModuleEntity;

  @Column({ name: 'course_id', type: 'uuid', nullable: true })
  courseId?: string;

  @Column({ type: 'uuid', nullable: true })
  rubric_id?: string;

  @ManyToOne(() => RubricEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'rubric_id' })
  rubric?: RubricEntity;

  @Column()
  title: string;

  @Column({ type: 'text', default: '' })
  description: string;

  @Column({
    type: 'enum',
    enum: AssignmentType,
    default: AssignmentType.LAB,
  })
  type: AssignmentType;

  @Column({ name: 'max_score', type: 'int', default: 100 })
  max_score: number;

  get maxScore(): number {
    return this.max_score;
  }
  set maxScore(val: number) {
    this.max_score = val;
  }

  @Column({ name: 'deadline', type: 'timestamp with time zone', nullable: true })
  deadline: Date;

  get dueDate(): Date {
    return this.deadline;
  }
  set dueDate(val: Date) {
    this.deadline = val;
  }
}
