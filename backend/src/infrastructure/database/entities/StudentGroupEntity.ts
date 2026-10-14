import { Entity, PrimaryColumn } from 'typeorm';

@Entity('student_groups')
export class StudentGroupEntity {
  @PrimaryColumn('uuid')
  student_id: string;

  @PrimaryColumn('uuid')
  group_id: string;
}
