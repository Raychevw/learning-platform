import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('academic_groups')
export class AcademicGroupEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string; // напр. "ІПЗ-412"

  @Column()
  faculty: string;

  @Column({ type: 'int', default: 1 })
  study_year: number;
}
