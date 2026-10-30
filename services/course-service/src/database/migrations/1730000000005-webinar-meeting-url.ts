import { MigrationInterface, QueryRunner } from 'typeorm';

/** Посилання на зовнішню конференцію (Meet/Zoom) для вебінару. */
export class WebinarMeetingUrl1730000000005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE public.webinars ADD COLUMN IF NOT EXISTS meeting_url character varying(512) NOT NULL DEFAULT '';`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE public.webinars DROP COLUMN IF EXISTS meeting_url;');
  }
}
