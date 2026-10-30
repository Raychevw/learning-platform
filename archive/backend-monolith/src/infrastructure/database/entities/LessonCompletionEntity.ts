import { Entity, PrimaryColumn, CreateDateColumn } from 'typeorm';

@Entity('lesson_completions')
export class LessonCompletionEntity {
  @PrimaryColumn('uuid')
  student_id: string;

  @PrimaryColumn('uuid')
  lesson_id: string;

  @CreateDateColumn()
  completed_at: Date;
}
