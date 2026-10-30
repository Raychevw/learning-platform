import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CourseEntity } from '../infrastructure/database/entities/CourseEntity.js';
import {
  CourseModuleEntity,
  LessonEntity,
  LessonCompletionEntity,
  WebinarEntity,
  ScheduleEntryEntity,
} from '../infrastructure/database/entities/CatalogEntities.js';

type SeedLesson = { id: string; title: string; type: string; content: string; completedBy?: string[] };
type SeedModule = { id: string; title: string; lessons: SeedLesson[] };
type SeedCourse = Omit<CourseEntity, 'createdAt' | 'ownerId'> & { modules: SeedModule[] };

const STUDENT = 'usr-student';

const COURSES: SeedCourse[] = [
  {
    id: 'c-1',
    title: 'Архітектура програмного забезпечення',
    instructor: 'Дмитро Коваленко, доц.',
    description: 'Чиста архітектура, патерни проектування GoF, принципи SOLID та побудова сучасних веб-систем.',
    semester: 7,
    totalHours: 120,
    isPublished: true,
    cover: '/course-coding.jpg',
    modules: [
      {
        id: 'm-1',
        title: 'Модуль 1: Принципи SOLID та Чиста архітектура',
        lessons: [
          {
            id: 'l-1',
            title: 'Лекція 1: Огляд шарів домену та інфраструктури',
            type: 'Лекція',
            completedBy: [STUDENT],
            content:
              'У чистій архітектурі бізнес-логіка знаходиться в центрі системи та не залежить від бази даних чи зовнішніх бібліотек. Усі залежності спрямовані всередину до доменної моделі.',
          },
          {
            id: 'l-2',
            title: 'Методичні вказівки до виконання лабораторних робіт',
            type: 'Методичка',
            completedBy: [STUDENT],
            content:
              'Посібник містить вимоги до оформлення звітів, побудови діаграм класів та критерії оцінювання практичних завдань.',
          },
        ],
      },
      {
        id: 'm-2',
        title: 'Модуль 2: Породжуючі та поведінкові патерни проектування',
        lessons: [
          {
            id: 'l-3',
            title: 'Відео-лекція: Застосування патерна Strategy на практиці',
            type: 'Відео',
            content:
              'Розгляд гнучкого вибору алгоритмів під час виконання програми на прикладі розрахунку рейтингових балів студентів.',
          },
          {
            id: 'l-4',
            title: 'Презентація: Побудова складних об’єктів через Builder',
            type: 'Презентація',
            content: 'Покрокове конструювання об’єктів навчальних завдань із критеріями оцінювання та термінами здачі.',
          },
        ],
      },
    ],
  },
  {
    id: 'c-2',
    title: 'Основи вебдизайну та ергономіка UX/UI',
    instructor: 'Олена Грищенко, ст. викл.',
    description: 'Проєктування інтерфейсів, доступність, типографіка та компонування сучасних освітніх платформ.',
    semester: 7,
    totalHours: 90,
    isPublished: true,
    cover: '/course-webdesign.jpg',
    modules: [
      {
        id: 'm-3',
        title: 'Модуль 1: Дизайн-системи та візуальна ієрархія',
        lessons: [
          {
            id: 'l-5',
            title: 'Лекція: Колірні схеми та контрастність в інтерфейсах',
            type: 'Лекція',
            completedBy: [STUDENT],
            content:
              'Правильно підібрана сітка та візуальні акценти дозволяють користувачу швидко знаходити потрібні розділи без зайвого візуального шуму.',
          },
          {
            id: 'l-6',
            title: 'Практикум: Інтерактивне прототипування у Figma',
            type: 'Методичка',
            content: 'Побудова адаптивних компонентів карток курсів, таблиць журналу та модальних вікон.',
          },
        ],
      },
    ],
  },
  {
    id: 'c-3',
    title: 'Математичні методи дослідження операцій',
    instructor: 'Василь Мельник, проф.',
    description: 'Теорія графів, симплекс-метод, оптимізаційні алгоритми та моделювання систем.',
    semester: 7,
    totalHours: 120,
    isPublished: true,
    cover: '/course-math.jpg',
    modules: [
      {
        id: 'm-4',
        title: 'Модуль 1: Лінійне програмування та потоки в мережах',
        lessons: [
          {
            id: 'l-7',
            title: 'Лекція 1: Постановка задачі лінійної оптимізації',
            type: 'Лекція',
            content:
              'Канонічна та стандартна форми задачі лінійного програмування. Геометрична інтерпретація допустимих розв’язків.',
          },
        ],
      },
    ],
  },
  {
    id: 'c-4',
    title: 'Бази даних та системи керування даними',
    instructor: 'Дмитро Коваленко, доц.',
    description: 'Реляційна модель, нормалізація, SQL, транзакції, індекси та ORM-відображення у PostgreSQL.',
    semester: 7,
    totalHours: 90,
    isPublished: false,
    cover: '/course-coding.jpg',
    modules: [
      {
        id: 'm-5',
        title: 'Модуль 1: Реляційна модель та SQL',
        lessons: [
          {
            id: 'l-8',
            title: 'Лекція 1: Нормальні форми та проєктування схеми',
            type: 'Лекція',
            content: 'Функціональні залежності, 1НФ–3НФ, НФБК. Приклади декомпозиції таблиць навчальної платформи.',
          },
          {
            id: 'l-9',
            title: 'Практикум: Запити SELECT, JOIN та агрегатні функції',
            type: 'Методичка',
            content: 'Побудова звітів успішності студентів за допомогою JOIN, GROUP BY та віконних функцій.',
          },
        ],
      },
    ],
  },
];

const WEBINARS: Array<Omit<WebinarEntity, 'course'>> = [
  {
    id: 'web-1',
    courseId: 'c-1',
    title: 'Онлайн-лекція: Чиста архітектура та інверсія залежностей',
    instructor: 'Дмитро Коваленко, доц.',
    scheduledAt: new Date(Date.now() - 15 * 60 * 1000),
    status: 'LIVE',
    chat: [],
  },
  {
    id: 'web-2',
    courseId: 'c-2',
    title: 'Практичний семінар: Розбір макетів студентських робіт',
    instructor: 'Олена Грищенко, ст. викл.',
    scheduledAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    status: 'SCHEDULED',
    chat: [],
  },
];

/** Fills an empty course_db with demo data on first start. */
@Injectable()
export class CatalogSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger(CatalogSeeder.name);

  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap() {
    if (process.env.SEED_DEMO_DATA === 'false') return;
    const courseRepo = this.dataSource.getRepository(CourseEntity);
    if ((await courseRepo.count()) > 0) return;

    await this.dataSource.transaction(async (em) => {
      for (const [ci, c] of COURSES.entries()) {
        const { modules, ...course } = c;
        await em.save(CourseEntity, {
          ...course,
          ownerId: 'usr-teacher',
          createdAt: new Date(Date.UTC(2026, 8, 1, 0, ci)),
        });
        for (const [mi, m] of modules.entries()) {
          await em.save(CourseModuleEntity, { id: m.id, courseId: c.id, title: m.title, orderIndex: mi + 1 });
          for (const [li, l] of m.lessons.entries()) {
            await em.save(LessonEntity, { id: l.id, moduleId: m.id, title: l.title, type: l.type, content: l.content, orderIndex: li + 1 });
            for (const userId of l.completedBy || []) {
              await em.save(LessonCompletionEntity, { lessonId: l.id, userId });
            }
          }
        }
      }
      for (const w of WEBINARS) {
        await em.save(WebinarEntity, w);
      }
    });
    this.logger.log(`Seeded course_db with ${COURSES.length} courses and ${WEBINARS.length} webinars`);
  }
}

/** Демо-розклад для першої групи; не дублюється, якщо записи вже є. */
@Injectable()
export class ScheduleSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger(ScheduleSeeder.name);

  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap() {
    if (process.env.SEED_DEMO_DATA === 'false') return;

    const repo = this.dataSource.getRepository(ScheduleEntryEntity);
    if ((await repo.count()) > 0) return;

    const courses = await this.dataSource.getRepository(CourseEntity).find({ order: { createdAt: 'ASC' } });
    if (courses.length === 0) return;

    const slots = [
      { course: courses[0], weekday: 1, startTime: '09:00', endTime: '10:30', room: 'А-301', lessonType: 'Лекція' },
      { course: courses[1] ?? courses[0], weekday: 2, startTime: '11:00', endTime: '12:30', room: 'Б-210', lessonType: 'Практика' },
      { course: courses[0], weekday: 3, startTime: '09:00', endTime: '10:30', room: 'А-305', lessonType: 'Лабораторна' },
      { course: courses[2] ?? courses[0], weekday: 4, startTime: '13:00', endTime: '14:30', room: 'В-102', lessonType: 'Лекція' },
    ];

    const rows = slots.map((slot, index) => ({
      id: `sch-seed-${index + 1}`,
      courseId: slot.course.id,
      groupId: 'g-1',
      weekday: slot.weekday,
      startTime: slot.startTime,
      endTime: slot.endTime,
      room: slot.room,
      lessonType: slot.lessonType,
      teacherName: slot.course.instructor || '',
      onlineUrl: '',
    }));

    await repo.save(rows);
    this.logger.log(`Seeded ${rows.length} schedule entries for group g-1`);
  }
}
