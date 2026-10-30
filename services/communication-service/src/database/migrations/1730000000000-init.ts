import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1730000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE public.messages (
        id character varying(64) NOT NULL,
        sender_id character varying(64) NOT NULL,
        sender_name character varying(255) NOT NULL DEFAULT '',
        sender_role character varying(16) NOT NULL DEFAULT '',
        recipient_id character varying(64) NOT NULL,
        recipient_name character varying(255) NOT NULL DEFAULT '',
        subject character varying(255) NOT NULL DEFAULT '',
        body text NOT NULL,
        course_id character varying(64),
        read_at timestamp with time zone,
        created_at timestamp with time zone NOT NULL DEFAULT now(),
        CONSTRAINT "PK_messages" PRIMARY KEY (id)
      );
      CREATE INDEX "IDX_messages_sender" ON public.messages (sender_id);
      CREATE INDEX "IDX_messages_recipient" ON public.messages (recipient_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS public.messages CASCADE;');
  }
}
