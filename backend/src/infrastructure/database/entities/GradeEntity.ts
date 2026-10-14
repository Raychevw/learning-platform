import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToOne, ManyToOne, JoinColumn } from 'typeorm';
import { SubmissionEntity } from './SubmissionEntity.js';
import { UserEntity } from './UserEntity.js';

@Entity('grades')
export class GradeEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  submission_id: string;

  @OneToOne(() => SubmissionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'submission_id' })
  submission?: SubmissionEntity;

  @Column('uuid')
  teacher_id: string;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'teacher_id' })
  teacher?: UserEntity;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  total_score: number;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  rubric_evaluation_json: Record<string, number>; // criterionId -> awarded score

  @Column({ type: 'text', default: '' })
  feedback_comment: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  graded_at: Date;
}
