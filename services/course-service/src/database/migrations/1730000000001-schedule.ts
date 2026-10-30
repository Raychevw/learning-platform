import { MigrationInterface, QueryRunner } from 'typeorm';

/** Розклад занять (Sprint: особистий кабінет студента). */
export class Schedule1730000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE public.schedule_entries (
        id character varying(64) NOT NULL,
        "courseId" character varying(64) NOT NULL,
        "groupId" character varying(64) NOT NULL,
        weekday integer NOT NULL,
        "startTime" character varying(5) NOT NULL,
        "endTime" character varying(5) NOT NULL,
        room character varying(64) NOT NULL DEFAULT '',
        "lessonType" character varying(32) NOT NULL DEFAULT 'Лекція',
        "teacherName" character varying(255) NOT NULL DEFAULT '',
        "onlineUrl" character varying(512) NOT NULL DEFAULT '',
        "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
        CONSTRAINT "PK_schedule_entries" PRIMARY KEY (id),
        CONSTRAINT "FK_schedule_course" FOREIGN KEY ("courseId")
          REFERENCES public.courses(id) ON DELETE CASCADE
      );
      CREATE INDEX "IDX_schedule_group" ON public.schedule_entries ("groupId", weekday, "startTime");
      CREATE INDEX "IDX_schedule_course" ON public.schedule_entries ("courseId");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS public.schedule_entries CASCADE;');
  }
}
