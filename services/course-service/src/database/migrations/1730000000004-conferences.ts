import { MigrationInterface, QueryRunner } from 'typeorm';

/** Відвідуваність конференцій і записи лекцій. */
export class Conferences1730000000004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE public.webinars ADD COLUMN IF NOT EXISTS recording_key character varying(512);
      ALTER TABLE public.webinars ADD COLUMN IF NOT EXISTS recording_name character varying(255) NOT NULL DEFAULT '';
      ALTER TABLE public.webinars ADD COLUMN IF NOT EXISTS recording_size character varying(32) NOT NULL DEFAULT '';
      ALTER TABLE public.webinars ADD COLUMN IF NOT EXISTS recording_mime character varying(128);
      ALTER TABLE public.webinars ADD COLUMN IF NOT EXISTS recording_at timestamp with time zone;

      CREATE TABLE public.webinar_attendance (
        id character varying(64) NOT NULL,
        webinar_id character varying(64) NOT NULL,
        user_id character varying(64) NOT NULL,
        user_name character varying(255) NOT NULL DEFAULT '',
        role character varying(16) NOT NULL DEFAULT '',
        joined_at timestamp with time zone NOT NULL DEFAULT now(),
        left_at timestamp with time zone,
        duration_seconds integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_webinar_attendance" PRIMARY KEY (id)
      );
      CREATE INDEX "IDX_attendance_webinar_user" ON public.webinar_attendance (webinar_id, user_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS public.webinar_attendance CASCADE;');
    await queryRunner.query(`
      ALTER TABLE public.webinars
        DROP COLUMN IF EXISTS recording_key,
        DROP COLUMN IF EXISTS recording_name,
        DROP COLUMN IF EXISTS recording_size,
        DROP COLUMN IF EXISTS recording_mime,
        DROP COLUMN IF EXISTS recording_at;
    `);
  }
}
