import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('students')
export class StudentEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column('simple-array')
  enrolledCourseIds: string[];
}
