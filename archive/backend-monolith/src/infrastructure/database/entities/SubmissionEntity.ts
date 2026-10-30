import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { AssignmentEntity } from './AssignmentEntity.js';
import { UserEntity } from './UserEntity.js';

export enum SubmissionStatus {
  SUBMITTED = 'SUBMITTED',
  CHECKING_PLAGIARISM = 'CHECKING_PLAGIARISM',
  READY_FOR_GRADING = 'READY_FOR_GRADING',
  GRADED = 'GRADED',
  REVISION_NEEDED = 'REVISION_NEEDED',
}

@Entity('submissions')
export class SubmissionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  assignment_id: string;

  @ManyToOne(() => AssignmentEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'assignment_id' })
  assignment?: AssignmentEntity;

  @Column('uuid')
  student_id: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student?: UserEntity;

  @Column({ type: 'text', nullable: true })
  file_url?: string; // S3 link

  @Column({ type: 'text', default: '' })
  student_comment: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  submitted_at: Date;

  @Column({
    type: 'enum',
    enum: SubmissionStatus,
    default: SubmissionStatus.SUBMITTED,
  })
  status: SubmissionStatus;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  plagiarism_score?: number;

  @Column({ type: 'text', nullable: true })
  plagiarism_report_url?: string;
}
