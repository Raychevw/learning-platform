import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

export interface RubricCriterion {
  id: string;
  name: string;
  description: string;
  max_score: number;
}

@Entity('rubrics')
export class RubricEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  criteria_json: RubricCriterion[];
}
