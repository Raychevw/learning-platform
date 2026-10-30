import { MigrationInterface, QueryRunner } from 'typeorm';

/** Куратор академічної групи. */
export class GroupCurator1730000000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE public.academic_groups ADD COLUMN IF NOT EXISTS curator_id character varying(64);',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_groups_curator" ON public.academic_groups (curator_id);',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_groups_curator";');
    await queryRunner.query('ALTER TABLE public.academic_groups DROP COLUMN IF EXISTS curator_id;');
  }
}
