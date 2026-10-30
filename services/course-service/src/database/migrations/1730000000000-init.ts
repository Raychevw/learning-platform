import { MigrationInterface, QueryRunner } from 'typeorm';

// Начальная схема, снятая с рабочей PostgreSQL (pg_dump --schema-only).
const UP_SQL = `
CREATE TABLE public.course_modules (
    id character varying(64) NOT NULL,
    "courseId" character varying(64) NOT NULL,
    title character varying(255) NOT NULL,
    "orderIndex" integer DEFAULT 0 NOT NULL
);
CREATE TABLE public.courses (
    title character varying(255) NOT NULL,
    description text NOT NULL,
    "isPublished" boolean DEFAULT false NOT NULL,
    instructor character varying(255) DEFAULT ''::character varying NOT NULL,
    semester integer DEFAULT 1 NOT NULL,
    "totalHours" integer DEFAULT 90 NOT NULL,
    cover character varying(255) DEFAULT '/course-coding.jpg'::character varying NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    id character varying(64) NOT NULL
);
CREATE TABLE public.lesson_completions (
    "lessonId" character varying(64) NOT NULL,
    "userId" character varying(64) NOT NULL,
    "completedAt" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.lessons (
    id character varying(64) NOT NULL,
    "moduleId" character varying(64) NOT NULL,
    title character varying(255) NOT NULL,
    type character varying(64) DEFAULT 'Лекція'::character varying NOT NULL,
    content text DEFAULT ''::text NOT NULL,
    "orderIndex" integer DEFAULT 0 NOT NULL
);
CREATE TABLE public.webinars (
    id character varying(64) NOT NULL,
    "courseId" character varying(64) NOT NULL,
    title character varying(255) NOT NULL,
    instructor character varying(255) DEFAULT ''::character varying NOT NULL,
    "scheduledAt" timestamp with time zone NOT NULL,
    status character varying(32) DEFAULT 'SCHEDULED'::character varying NOT NULL,
    chat jsonb DEFAULT '[]'::jsonb NOT NULL
);
ALTER TABLE ONLY public.courses
    ADD CONSTRAINT "PK_3f70a487cc718ad8eda4e6d58c9" PRIMARY KEY (id);
ALTER TABLE ONLY public.course_modules
    ADD CONSTRAINT "PK_4c195db0718e8845a6e09075ebc" PRIMARY KEY (id);
ALTER TABLE ONLY public.lessons
    ADD CONSTRAINT "PK_9b9a8d455cac672d262d7275730" PRIMARY KEY (id);
ALTER TABLE ONLY public.lesson_completions
    ADD CONSTRAINT "PK_9f2a41feb3c1e1724a5c5dc9519" PRIMARY KEY ("lessonId", "userId");
ALTER TABLE ONLY public.webinars
    ADD CONSTRAINT "PK_cadbb48a8b68ff75901903d7eea" PRIMARY KEY (id);
CREATE INDEX "IDX_0897bbf701a89c406d8561041a" ON public.webinars USING btree ("courseId");
CREATE INDEX "IDX_0a332e19d988804687be4637bf" ON public.course_modules USING btree ("courseId");
CREATE INDEX "IDX_16e7969589c0b789d986878225" ON public.lessons USING btree ("moduleId");
ALTER TABLE ONLY public.webinars
    ADD CONSTRAINT "FK_0897bbf701a89c406d8561041ac" FOREIGN KEY ("courseId") REFERENCES public.courses(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.course_modules
    ADD CONSTRAINT "FK_0a332e19d988804687be4637bfc" FOREIGN KEY ("courseId") REFERENCES public.courses(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.lessons
    ADD CONSTRAINT "FK_16e7969589c0b789d9868782259" FOREIGN KEY ("moduleId") REFERENCES public.course_modules(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.lesson_completions
    ADD CONSTRAINT "FK_5241b14081904537154f16b15dc" FOREIGN KEY ("lessonId") REFERENCES public.lessons(id) ON DELETE CASCADE;
`;

const DOWN_SQL = `
DROP TABLE IF EXISTS public.course_modules CASCADE;
DROP TABLE IF EXISTS public.courses CASCADE;
DROP TABLE IF EXISTS public.lesson_completions CASCADE;
DROP TABLE IF EXISTS public.lessons CASCADE;
DROP TABLE IF EXISTS public.webinars CASCADE;
`;

export class Init1730000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(UP_SQL);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(DOWN_SQL);
  }
}