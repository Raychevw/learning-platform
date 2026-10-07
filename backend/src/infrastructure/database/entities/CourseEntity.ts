import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('courses')
export class CourseEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ nullable: true })
  description: string;

  @Column({ default: false })
  isPublished: boolean;
}
