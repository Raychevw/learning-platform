import { MigrationInterface, QueryRunner } from 'typeorm';

/** Власник курсу: викладач, відповідальний за дисципліну. */
export class CourseOwner1730000000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS owner_id character varying(64);');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_courses_owner" ON public.courses (owner_id);');
    // Існуючі демо-курси закріплюємо за демо-викладачем.
    await queryRunner.query(`UPDATE public.courses SET owner_id = 'usr-teacher' WHERE owner_id IS NULL;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_courses_owner";');
    await queryRunner.query('ALTER TABLE public.courses DROP COLUMN IF EXISTS owner_id;');
  }
}
