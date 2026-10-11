import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('courses')
export class CourseEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ length: 255 })
  title!: string;

  @Column('text')
  description!: string;

  @Column({ default: false })
  isPublished!: boolean;
}
