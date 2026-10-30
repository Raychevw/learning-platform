import { MigrationInterface, QueryRunner } from 'typeorm';

/** Вкладення та посилання для навчальних матеріалів. */
export class LessonMaterials1730000000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS link_url character varying(512) NOT NULL DEFAULT '';
      ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS video_url character varying(512) NOT NULL DEFAULT '';
      ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS file_key character varying(512);
      ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS file_name character varying(255) NOT NULL DEFAULT '';
      ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS file_size character varying(32) NOT NULL DEFAULT '';
      ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS mime_type character varying(128);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE public.lessons
        DROP COLUMN IF EXISTS link_url,
        DROP COLUMN IF EXISTS video_url,
        DROP COLUMN IF EXISTS file_key,
        DROP COLUMN IF EXISTS file_name,
        DROP COLUMN IF EXISTS file_size,
        DROP COLUMN IF EXISTS mime_type;
    `);
  }
}
