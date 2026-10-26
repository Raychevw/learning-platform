import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { AssignmentEntity } from './AssignmentEntity.js';

/** READY_FOR_GRADING | GRADED | REVISION_NEEDED */
@Entity('submissions')
@Index(['assignmentId', 'studentId'], { unique: true })
export class SubmissionEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ type: 'varchar', length: 64 })
  assignmentId!: string;

  @ManyToOne(() => AssignmentEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'assignmentId' })
  assignment?: AssignmentEntity;

  @Column({ type: 'varchar', length: 64 })
  studentId!: string;

  @Column({ length: 255 })
  studentName!: string;

  @Column({ name: 'group_name', length: 64, default: '' })
  group!: string;

  @Column({ type: 'timestamp with time zone', default: () => 'now()' })
  submittedAt!: Date;

  @Column({ length: 255, default: '' })
  fileName!: string;

  @Column({ length: 32, default: '' })
  fileSize!: string;

  @Column({ type: 'text', default: '' })
  comment!: string;

  @Column({ length: 32, default: 'READY_FOR_GRADING' })
  status!: string;

  @Column({ type: 'numeric', precision: 6, scale: 2, nullable: true, transformer: { to: (v) => v, from: (v) => (v === null ? null : Number(v)) } })
  score!: number | null;
}

@Entity('grades')
export class GradeEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ type: 'varchar', length: 64 })
  assignmentId!: string;

  /** One grade per submission (no FK: historical grades may reference archived submissions) */
  @Column({ type: 'varchar', length: 64, unique: true })
  submissionId!: string;

  @Column({ type: 'varchar', length: 64 })
  studentId!: string;

  @Column({ length: 255 })
  studentName!: string;

  @Column({ name: 'group_name', length: 64, default: '' })
  group!: string;

  @Column({ length: 255, default: '' })
  courseTitle!: string;

  @Column({ length: 255, default: '' })
  assignmentTitle!: string;

  @Column({ type: 'timestamp with time zone', default: () => 'now()' })
  gradedAt!: Date;

  @Column({ type: 'numeric', precision: 6, scale: 2, transformer: { to: (v) => v, from: (v) => Number(v) } })
  rawScore!: number;

  @Column({ type: 'numeric', precision: 6, scale: 2, transformer: { to: (v) => v, from: (v) => Number(v) } })
  finalScore!: number;

  @Column('int')
  maxScore!: number;

  /** STANDARD | LATE_PENALTY | EXCELLENCE_BONUS (Strategy pattern) */
  @Column({ length: 32, default: 'STANDARD' })
  rule!: string;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  criteriaScores!: Record<string, number>;

  @Column({ type: 'text', default: '' })
  feedback!: string;
}

@Entity('academic_groups')
export class AcademicGroupEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ length: 64, unique: true })
  name!: string;

  @Column({ length: 64, default: 'ФІОТ' })
  faculty!: string;

  @Column({ type: 'int', default: 1 })
  studyYear!: number;

  /** Planned enrollment of the group (contingent) */
  @Column({ type: 'int', default: 25 })
  studentsCount!: number;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  assignedCourseIds!: string[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  studentsList!: string[];

  @Column({ type: 'timestamp with time zone', default: () => 'now()' })
  createdAt!: Date;
}
