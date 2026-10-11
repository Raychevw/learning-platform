import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('assignments')
export class AssignmentEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid')
  courseId!: string;

  @Column({ length: 255, default: 'Untitled Course' })
  courseTitle!: string;

  @Column({ length: 255 })
  title!: string;

  @Column('int')
  maxScore!: number;

  @Column('timestamp')
  dueDate!: Date;

  @Column({ default: true })
  isCourseVerified!: boolean;
}
