import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { CourseEntity } from './CourseEntity.js';

@Entity('course_modules')
export class CourseModuleEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  course_id: string;

  @ManyToOne(() => CourseEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'course_id' })
  course?: CourseEntity;

  @Column()
  title: string;

  @Column({ type: 'int', default: 0 })
  order_index: number;
}
