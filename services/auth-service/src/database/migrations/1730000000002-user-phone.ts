import { MigrationInterface, QueryRunner } from 'typeorm';

/** Мобільний номер користувача (для зв'язку деканату зі студентом). */
export class UserPhone1730000000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone character varying(32);`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE public.users DROP COLUMN IF EXISTS phone;');
  }
}
