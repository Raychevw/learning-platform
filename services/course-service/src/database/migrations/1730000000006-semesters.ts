import { MigrationInterface, QueryRunner } from 'typeorm';

/** Навчальні семестри. */
export class Semesters1730000000006 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE public.semesters (
        id character varying(64) NOT NULL,
        name character varying(255) NOT NULL,
        number integer NOT NULL,
        start_date timestamp with time zone NOT NULL,
        end_date timestamp with time zone NOT NULL,
        is_active boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_semesters" PRIMARY KEY (id)
      );
      CREATE UNIQUE INDEX "IDX_semesters_active" ON public.semesters (is_active) WHERE is_active = true;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS public.semesters CASCADE;');
  }
}
