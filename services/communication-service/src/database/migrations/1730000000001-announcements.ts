import { MigrationInterface, QueryRunner } from 'typeorm';

export class Announcements1730000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE public.announcements (
        id character varying(64) NOT NULL,
        author_id character varying(64) NOT NULL,
        author_name character varying(255) NOT NULL DEFAULT '',
        author_role character varying(16) NOT NULL DEFAULT '',
        title character varying(255) NOT NULL,
        body text NOT NULL,
        audience character varying(16) NOT NULL DEFAULT 'ALL',
        group_id character varying(64),
        created_at timestamp with time zone NOT NULL DEFAULT now(),
        CONSTRAINT "PK_announcements" PRIMARY KEY (id)
      );
      CREATE INDEX "IDX_announcements_audience" ON public.announcements (audience);
      CREATE INDEX "IDX_announcements_created" ON public.announcements (created_at);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS public.announcements CASCADE;');
  }
}
