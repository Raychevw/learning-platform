import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { UserEntity } from './UserEntity.js';

@Entity('courses')
export class CourseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text', default: '' })
  description: string;

  @Column({ type: 'int', default: 1 })
  semester: number;

  @Column('uuid')
  teacher_id: string;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'teacher_id' })
  teacher?: UserEntity;

  @Column({ default: false })
  isPublished: boolean;
}
