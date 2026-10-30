import { MigrationInterface, QueryRunner } from 'typeorm';

// Начальная схема, снятая с рабочей PostgreSQL (pg_dump --schema-only).
const UP_SQL = `
CREATE TABLE public.users (
    id character varying(64) NOT NULL,
    email character varying(255) NOT NULL,
    username character varying(64),
    password_hash character varying(255) NOT NULL,
    full_name character varying(255) NOT NULL,
    role character varying(16) DEFAULT 'STUDENT'::character varying NOT NULL,
    department character varying(255),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    last_login_at timestamp with time zone
);
ALTER TABLE ONLY public.users
    ADD CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY (id);
CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON public.users USING btree (email);
CREATE UNIQUE INDEX "IDX_fe0bb3f6520ee0469504521e71" ON public.users USING btree (username);
`;

const DOWN_SQL = `
DROP TABLE IF EXISTS public.users CASCADE;
`;

export class Init1730000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(UP_SQL);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(DOWN_SQL);
  }
}