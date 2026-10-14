import { Entity, PrimaryColumn } from 'typeorm';

@Entity('course_groups')
export class CourseGroupEntity {
  @PrimaryColumn('uuid')
  course_id: string;

  @PrimaryColumn('uuid')
  group_id: string;
}
