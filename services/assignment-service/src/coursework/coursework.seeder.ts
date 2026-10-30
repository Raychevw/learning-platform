import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AssignmentEntity } from '../infrastructure/database/entities/AssignmentEntity.js';
import { StudentEntity } from '../infrastructure/database/entities/StudentEntity.js';
import {
  SubmissionEntity,
  GradeEntity,
  AcademicGroupEntity,
  EnrollmentEntity,
} from '../infrastructure/database/entities/CourseworkEntities.js';

const daysFromNow = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

const DEMO_ASSIGNMENTS = [
  {
    id: 'asg-1',
    courseId: 'c-1',
    courseTitle: 'Архітектура програмного забезпечення',
    title: 'Лабораторна робота 3: Проектування REST API та взаємодії модулів',
    description: 'Спроектувати контракти взаємодії між модулями курсів та оцінювання.',
    type: 'Лабораторна',
    dueDate: daysFromNow(5),
    maxScore: 100,
    rubricTitle: 'Чиста архітектура (3 критерії)',
    isCourseVerified: true,
    criteria: [
      { id: 'clean_arch', name: 'Чиста архітектура та поділ шарів', max: 35 },
      { id: 'patterns', name: 'Правильність застосування патернів', max: 35 },
      { id: 'tests', name: 'Покриття модульними тестами', max: 30 },
    ],
  },
  {
    id: 'asg-2',
    courseId: 'c-1',
    courseTitle: 'Архітектура програмного забезпечення',
    title: 'Лабораторна робота 4: Патерни Decorator та Strategy',
    description: 'Реалізувати гнучкий розрахунок підсумкових балів та кешування даних.',
    type: 'Лабораторна',
    dueDate: daysFromNow(12),
    maxScore: 100,
    rubricTitle: 'Шаблони проектування GoF',
    isCourseVerified: true,
    criteria: [
      { id: 'clean_arch', name: 'Реалізація патерна Strategy', max: 40 },
      { id: 'patterns', name: 'Реалізація патерна Decorator', max: 35 },
      { id: 'tests', name: 'Модульні тести та висновки', max: 25 },
    ],
  },
  {
    id: 'asg-3',
    courseId: 'c-2',
    courseTitle: 'Основи вебдизайну та ергономіка UX/UI',
    title: 'Практична робота 2: Макет навчального кабінету',
    description: 'Розробити інтерактивний дизайн-прототип системи навчання.',
    type: 'Практична',
    dueDate: daysFromNow(19),
    maxScore: 100,
    rubricTitle: 'Ергономіка та дизайн',
    isCourseVerified: true,
    criteria: [
      { id: 'clean_arch', name: 'Компонування та модульна сітка', max: 40 },
      { id: 'patterns', name: 'Колористика та типографіка', max: 35 },
      { id: 'tests', name: 'Зручність навігації', max: 25 },
    ],
  },
];

const DEMO_SUBMISSIONS = [
  {
    id: 'sub-1',
    assignmentId: 'asg-1',
    studentId: 'usr-student',
    studentName: 'Олександр Петренко',
    group: 'ІПЗ-412',
    submittedAt: new Date('2026-10-14T12:30:00.000Z'),
    fileName: 'Звіт_Лаб3_Петренко_ІПЗ412.pdf',
    fileSize: '1.4 МБ',
    comment: 'Виконано відповідно до методичних вказівок. Посилання на репозиторій додано у звіт.',
    status: 'READY_FOR_GRADING',
    score: null,
  },
];

const DEMO_GRADES = [
  {
    id: 'grd-1',
    assignmentId: 'asg-prev-1',
    submissionId: 'sub-prev-1',
    studentId: 'usr-student',
    studentName: 'Олександр Петренко',
    group: 'ІПЗ-412',
    courseTitle: 'Архітектура програмного забезпечення',
    assignmentTitle: 'Лабораторна робота 2: Декомпозиція модулів системи',
    gradedAt: new Date('2026-10-10T12:00:00.000Z'),
    rawScore: 95,
    finalScore: 95,
    maxScore: 100,
    rule: 'STANDARD',
    criteriaScores: { clean_arch: 33, patterns: 34, tests: 28 },
    feedback: 'Відмінно виконано декомпозицію модулів. Дотримано всіх вимог.',
  },
  {
    id: 'grd-2',
    assignmentId: 'asg-prev-2',
    submissionId: 'sub-prev-2',
    studentId: 'usr-student',
    studentName: 'Олександр Петренко',
    group: 'ІПЗ-412',
    courseTitle: 'Основи вебдизайну та ергономіка UX/UI',
    assignmentTitle: 'Практична робота 1: Аналіз патернів навігації',
    gradedAt: new Date('2026-10-11T14:00:00.000Z'),
    rawScore: 92,
    finalScore: 97,
    maxScore: 100,
    rule: 'EXCELLENCE_BONUS',
    criteriaScores: { clean_arch: 38, patterns: 32, tests: 22 },
    feedback: 'Гарна колористика та якісне компонування інтерфейсу.',
  },
];

const DEMO_GROUPS = [
  {
    id: 'g-1',
    name: 'ІПЗ-412',
    faculty: 'ФІОТ',
    specialty: 'Інженерія програмного забезпечення',
    studyYear: 4,
    studentsCount: 0,
    assignedCourseIds: ['c-1', 'c-2', 'c-3'],
    studentsList: [],
  },
  {
    id: 'g-2',
    name: 'ІПЗ-411',
    faculty: 'ФІОТ',
    specialty: 'Інженерія програмного забезпечення',
    studyYear: 4,
    studentsCount: 0,
    assignedCourseIds: ['c-1', 'c-2'],
    studentsList: [],
  },
  {
    id: 'g-3',
    name: 'КН-301',
    faculty: 'ФІОТ',
    specialty: 'Комп’ютерні науки',
    studyYear: 3,
    studentsCount: 0,
    assignedCourseIds: ['c-2', 'c-3'],
    studentsList: [],
  },
];

const DEMO_STUDENTS = [
  {
    id: 'usr-student',
    name: 'Олександр Петренко',
    email: 'o.petrenko@univ.edu.ua',
    enrolledCourseIds: ['c-1', 'c-2', 'c-3'],
  },
];

@Injectable()
export class CourseworkSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger(CourseworkSeeder.name);

  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap() {
    if (process.env.SEED_DEMO_DATA === 'false') return;

    const asgRepo = this.dataSource.getRepository(AssignmentEntity);
    if ((await asgRepo.count()) === 0) {
      await this.dataSource.transaction(async (em) => {
        for (const a of DEMO_ASSIGNMENTS) {
          await em.save(AssignmentEntity, a);
        }
        for (const s of DEMO_SUBMISSIONS) {
          await em.save(SubmissionEntity, s);
        }
        for (const g of DEMO_GRADES) {
          await em.save(GradeEntity, g);
        }
        for (const gr of DEMO_GROUPS) {
          await em.save(AcademicGroupEntity, gr);
        }
        for (const st of DEMO_STUDENTS) {
          await em.save(StudentEntity, st);
        }
      });
      this.logger.log('Seeded assignment_db with assignments, submissions, grades, groups, students');
    }

    // Зачисления сидим отдельно: существующие БД тоже должны получить связь user -> group.
    const enrollmentRepo = this.dataSource.getRepository(EnrollmentEntity);
    if ((await enrollmentRepo.count()) === 0) {
      const groupRepo = this.dataSource.getRepository(AcademicGroupEntity);
      const group =
        (await groupRepo.findOne({ where: { name: 'ІПЗ-412' } })) ??
        (await groupRepo.findOne({ order: { createdAt: 'ASC' } }));

      if (group) {
        await enrollmentRepo.save(
          enrollmentRepo.create({
            id: 'enr-student-1',
            userId: 'usr-student',
            groupId: group.id,
            studentName: 'Олександр Петренко',
          }),
        );
        this.logger.log(`Enrolled demo student into group "${group.name}"`);
      }
    }
  }
}
