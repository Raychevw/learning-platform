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

  /** Storage key of the uploaded artifact (null for legacy submissions without a file). */
  @Column({ type: 'varchar', length: 512, nullable: true })
  fileKey!: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  mimeType!: string | null;

  /** True when the work was submitted after the assignment deadline. */
  @Column({ name: 'is_late', type: 'boolean', default: false })
  isLate!: boolean;

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

  @Column({ name: 'is_late', type: 'boolean', default: false })
  isLate!: boolean;

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

  @Column({ length: 255, default: '' })
  specialty!: string;

  /** Куратор групи (id викладача з auth-service). */
  @Column({ name: 'curator_id', type: 'varchar', length: 64, nullable: true })
  curatorId!: string | null;

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

/**
 * Student ↔ academic group mapping (one active group per student).
 * Replaces the old free-text `studentsList` for authorization/attribution.
 */
@Entity('enrollments')
export class EnrollmentEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ name: 'user_id', type: 'varchar', length: 64, unique: true })
  userId!: string;

  @Column({ name: 'group_id', type: 'varchar', length: 64 })
  groupId!: string;

  @Column({ name: 'student_name', type: 'varchar', length: 255, default: '' })
  studentName!: string;

  @Column({ type: 'timestamp with time zone', default: () => 'now()' })
  createdAt!: Date;
}
