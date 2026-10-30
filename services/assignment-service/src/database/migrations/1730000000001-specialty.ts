import { MigrationInterface, QueryRunner } from 'typeorm';

/** Спеціальність групи для особистого кабінету студента. */
export class Specialty1730000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE public.academic_groups ADD COLUMN IF NOT EXISTS specialty character varying(255) NOT NULL DEFAULT '';`,
    );
    await queryRunner.query(
      `UPDATE public.academic_groups SET specialty = 'Інженерія програмного забезпечення' WHERE name IN ('ІПЗ-412', 'ІПЗ-411');`,
    );
    await queryRunner.query(
      `UPDATE public.academic_groups SET specialty = 'Комп''ютерні науки' WHERE name = 'КН-301';`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE public.academic_groups DROP COLUMN IF EXISTS specialty;');
  }
}
