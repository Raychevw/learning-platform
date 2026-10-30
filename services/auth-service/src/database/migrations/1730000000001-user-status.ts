import { MigrationInterface, QueryRunner } from 'typeorm';

/** Статус навчання користувача. */
export class UserStatus1730000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE public.users ADD COLUMN IF NOT EXISTS status character varying(24) NOT NULL DEFAULT 'ACTIVE';`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE public.users DROP COLUMN IF EXISTS status;');
  }
}
