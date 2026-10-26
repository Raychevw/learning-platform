import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('students')
export class StudentEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ length: 255 })
  name!: string;

  @Column({ length: 255, unique: true })
  email!: string;

  @Column('simple-array', { default: '' })
  enrolledCourseIds!: string[];
}
