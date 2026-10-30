import { MigrationInterface, QueryRunner } from 'typeorm';

// Начальная схема, снятая с рабочей PostgreSQL (pg_dump --schema-only).
const UP_SQL = `
CREATE TABLE public.audit_logs (
    id character varying(64) NOT NULL,
    user_id character varying(64) DEFAULT 'anonymous'::character varying NOT NULL,
    user_role character varying(16) DEFAULT ''::character varying NOT NULL,
    user_name character varying(255) DEFAULT ''::character varying NOT NULL,
    action character varying(128) NOT NULL,
    resource character varying(255) DEFAULT ''::character varying NOT NULL,
    method character varying(8) DEFAULT 'GET'::character varying NOT NULL,
    path character varying(512) DEFAULT ''::character varying NOT NULL,
    status_code integer DEFAULT 0 NOT NULL,
    status character varying(16) DEFAULT 'ALLOWED'::character varying NOT NULL,
    ip character varying(64) DEFAULT ''::character varying NOT NULL,
    request_id character varying(64) DEFAULT ''::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY (id);
CREATE INDEX "IDX_2961862b2704794af56359ff0a" ON public.audit_logs USING btree (status);
CREATE INDEX "IDX_2cd10fda8276bb995288acfbfb" ON public.audit_logs USING btree (created_at);
CREATE INDEX "IDX_bd2726fd31b35443f2245b93ba" ON public.audit_logs USING btree (user_id);
`;

const DOWN_SQL = `
DROP TABLE IF EXISTS public.audit_logs CASCADE;
`;

export class Init1730000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(UP_SQL);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(DOWN_SQL);
  }
}