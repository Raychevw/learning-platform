import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('courses')
export class CourseEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ length: 255 })
  title!: string;

  @Column('text')
  description!: string;

  @Column({ default: false })
  isPublished!: boolean;

  // Catalog metadata (managed by CatalogService, ignored by the Course aggregate)
  @Column({ length: 255, default: '' })
  instructor!: string;

  @Column({ type: 'int', default: 1 })
  semester!: number;

  @Column({ type: 'int', default: 90 })
  totalHours!: number;

  @Column({ length: 255, default: '/course-coding.jpg' })
  cover!: string;

  @Column({ type: 'timestamp with time zone', default: () => 'now()' })
  createdAt!: Date;
}
