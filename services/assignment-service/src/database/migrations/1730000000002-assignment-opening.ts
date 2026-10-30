import { MigrationInterface, QueryRunner } from 'typeorm';

/** Дата відкриття завдання та дозволені формати відповіді. */
export class AssignmentOpening1730000000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS open_at timestamp with time zone;');
    await queryRunner.query(
      `ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS allowed_formats jsonb NOT NULL DEFAULT '["pdf","docx"]'::jsonb;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE public.assignments DROP COLUMN IF EXISTS allowed_formats;');
    await queryRunner.query('ALTER TABLE public.assignments DROP COLUMN IF EXISTS open_at;');
  }
}
