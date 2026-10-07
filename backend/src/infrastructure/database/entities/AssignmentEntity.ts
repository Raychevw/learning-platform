import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('assignments')
export class AssignmentEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column()
  courseId: string;

  @Column()
  title: string;

  @Column('int')
  maxScore: number;

  @Column()
  dueDate: Date;
}
