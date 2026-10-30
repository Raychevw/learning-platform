import { MigrationInterface, QueryRunner } from 'typeorm';

// Начальная схема, снятая с рабочей PostgreSQL (pg_dump --schema-only).
const UP_SQL = `
CREATE TABLE public.academic_groups (
    id character varying(64) NOT NULL,
    name character varying(64) NOT NULL,
    faculty character varying(64) DEFAULT 'ФІОТ'::character varying NOT NULL,
    "studyYear" integer DEFAULT 1 NOT NULL,
    "studentsCount" integer DEFAULT 25 NOT NULL,
    "assignedCourseIds" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "studentsList" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.assignments (
    id character varying(64) NOT NULL,
    "courseId" character varying(64) NOT NULL,
    "courseTitle" character varying(255) DEFAULT 'Untitled Course'::character varying NOT NULL,
    title character varying(255) NOT NULL,
    "maxScore" integer NOT NULL,
    "dueDate" timestamp with time zone NOT NULL,
    "isCourseVerified" boolean DEFAULT true NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    type character varying(64) DEFAULT 'Лабораторна'::character varying NOT NULL,
    "rubricTitle" character varying(255) DEFAULT ''::character varying NOT NULL,
    criteria jsonb DEFAULT '[]'::jsonb NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.enrollments (
    id character varying(64) NOT NULL,
    user_id character varying(64) NOT NULL,
    group_id character varying(64) NOT NULL,
    student_name character varying(255) DEFAULT ''::character varying NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.grades (
    id character varying(64) NOT NULL,
    "assignmentId" character varying(64) NOT NULL,
    "submissionId" character varying(64) NOT NULL,
    "studentId" character varying(64) NOT NULL,
    "studentName" character varying(255) NOT NULL,
    group_name character varying(64) DEFAULT ''::character varying NOT NULL,
    "courseTitle" character varying(255) DEFAULT ''::character varying NOT NULL,
    "assignmentTitle" character varying(255) DEFAULT ''::character varying NOT NULL,
    "gradedAt" timestamp with time zone DEFAULT now() NOT NULL,
    "rawScore" numeric(6,2) NOT NULL,
    "finalScore" numeric(6,2) NOT NULL,
    "maxScore" integer NOT NULL,
    rule character varying(32) DEFAULT 'STANDARD'::character varying NOT NULL,
    "criteriaScores" jsonb DEFAULT '{}'::jsonb NOT NULL,
    feedback text DEFAULT ''::text NOT NULL,
    is_late boolean DEFAULT false NOT NULL
);
CREATE TABLE public.students (
    id character varying(64) NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    "enrolledCourseIds" text DEFAULT ''::text NOT NULL
);
CREATE TABLE public.submissions (
    id character varying(64) NOT NULL,
    "assignmentId" character varying(64) NOT NULL,
    "studentId" character varying(64) NOT NULL,
    "studentName" character varying(255) NOT NULL,
    group_name character varying(64) DEFAULT ''::character varying NOT NULL,
    "submittedAt" timestamp with time zone DEFAULT now() NOT NULL,
    "fileName" character varying(255) DEFAULT ''::character varying NOT NULL,
    "fileSize" character varying(32) DEFAULT ''::character varying NOT NULL,
    comment text DEFAULT ''::text NOT NULL,
    status character varying(32) DEFAULT 'READY_FOR_GRADING'::character varying NOT NULL,
    score numeric(6,2),
    "fileKey" character varying(512),
    "mimeType" character varying(128),
    is_late boolean DEFAULT false NOT NULL
);
ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT "PK_10b3be95b8b2fb1e482e07d706b" PRIMARY KEY (id);
ALTER TABLE ONLY public.grades
    ADD CONSTRAINT "PK_4740fb6f5df2505a48649f1687b" PRIMARY KEY (id);
ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT "PK_7c0f752f9fb68bf6ed7367ab00f" PRIMARY KEY (id);
ALTER TABLE ONLY public.students
    ADD CONSTRAINT "PK_7d7f07271ad4ce999880713f05e" PRIMARY KEY (id);
ALTER TABLE ONLY public.academic_groups
    ADD CONSTRAINT "PK_bb10bfe8826d85b9f8dc161a277" PRIMARY KEY (id);
ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT "PK_c54ca359535e0012b04dcbd80ee" PRIMARY KEY (id);
ALTER TABLE ONLY public.students
    ADD CONSTRAINT "UQ_25985d58c714a4a427ced57507b" UNIQUE (email);
ALTER TABLE ONLY public.academic_groups
    ADD CONSTRAINT "UQ_54e1f075203631e109f5c71583f" UNIQUE (name);
ALTER TABLE ONLY public.grades
    ADD CONSTRAINT "UQ_d9d3e0c4ac49ec8411b52f2fb87" UNIQUE ("submissionId");
ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT "UQ_ff997f5a39cd24a491b9aca45c9" UNIQUE (user_id);
CREATE UNIQUE INDEX "IDX_d08e86921fcb85d36ba6aa41bf" ON public.submissions USING btree ("assignmentId", "studentId");
ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT "FK_c2611c601f49945ceff5c0909a2" FOREIGN KEY ("assignmentId") REFERENCES public.assignments(id) ON DELETE CASCADE;
`;

const DOWN_SQL = `
DROP TABLE IF EXISTS public.academic_groups CASCADE;
DROP TABLE IF EXISTS public.assignments CASCADE;
DROP TABLE IF EXISTS public.enrollments CASCADE;
DROP TABLE IF EXISTS public.grades CASCADE;
DROP TABLE IF EXISTS public.students CASCADE;
DROP TABLE IF EXISTS public.submissions CASCADE;
`;

export class Init1730000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(UP_SQL);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(DOWN_SQL);
  }
}