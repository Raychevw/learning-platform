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
const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

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
  {
    id: 'asg-prev-1',
    courseId: 'c-1',
    courseTitle: 'Архітектура програмного забезпечення',
    title: 'Лабораторна робота 2: Декомпозиція модулів системи',
    description: 'Розділити систему на модулі, описати межі відповідальності та контракти взаємодії.',
    type: 'Лабораторна',
    dueDate: daysFromNow(-20),
    maxScore: 100,
    rubricTitle: 'Декомпозиція та межі модулів',
    isCourseVerified: true,
    criteria: [
      { id: 'clean_arch', name: 'Межі модулів та залежності', max: 35 },
      { id: 'patterns', name: 'Контракти взаємодії', max: 35 },
      { id: 'tests', name: 'Тести та документація', max: 30 },
    ],
  },
  {
    id: 'asg-prev-2',
    courseId: 'c-2',
    courseTitle: 'Основи вебдизайну та ергономіка UX/UI',
    title: 'Практична робота 1: Аналіз патернів навігації',
    description: 'Проаналізувати навігаційні патерни освітніх платформ і запропонувати власну схему.',
    type: 'Практична',
    dueDate: daysFromNow(-19),
    maxScore: 100,
    rubricTitle: 'Навігація та ергономіка',
    isCourseVerified: true,
    criteria: [
      { id: 'clean_arch', name: 'Структура та компонування', max: 40 },
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
  {
    id: 'sub-prev-1',
    assignmentId: 'asg-prev-1',
    studentId: 'usr-student',
    studentName: 'Олександр Петренко',
    group: 'ІПЗ-412',
    submittedAt: new Date('2026-10-08T12:00:00.000Z'),
    fileName: 'Звіт_Лаб2_Петренко_ІПЗ412.pdf',
    fileSize: '1.1 МБ',
    comment: 'Декомпозицію виконано, контракти модулів описано у звіті.',
    status: 'GRADED',
    score: 95,
  },
  {
    id: 'sub-prev-2',
    assignmentId: 'asg-prev-2',
    studentId: 'usr-student',
    studentName: 'Олександр Петренко',
    group: 'ІПЗ-412',
    submittedAt: new Date('2026-10-09T14:00:00.000Z'),
    fileName: 'Практична_1_Петренко_ІПЗ412.pdf',
    fileSize: '0.9 МБ',
    comment: 'Проаналізовано навігацію трьох освітніх платформ, додано власну схему.',
    status: 'GRADED',
    score: 97,
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
  {
    id: 'usr-student-2',
    name: 'Марина Шевченко',
    email: 'm.shevchenko@univ.edu.ua',
    enrolledCourseIds: ['c-1', 'c-2', 'c-3'],
  },
  {
    id: 'usr-student-3',
    name: 'Ігор Бондаренко',
    email: 'i.bondarenko@univ.edu.ua',
    enrolledCourseIds: ['c-1', 'c-2', 'c-3'],
  },
  {
    id: 'usr-student-4',
    name: 'Софія Мельник',
    email: 's.melnyk@univ.edu.ua',
    enrolledCourseIds: ['c-1', 'c-2'],
  },
  {
    id: 'usr-student-5',
    name: 'Назар Кравчук',
    email: 'n.kravchuk@univ.edu.ua',
    enrolledCourseIds: ['c-1', 'c-2'],
  },
  {
    id: 'usr-student-6',
    name: 'Юлія Ткаченко',
    email: 'y.tkachenko@univ.edu.ua',
    enrolledCourseIds: ['c-2', 'c-3'],
  },
  {
    id: 'usr-student-7',
    name: 'Артем Гончаренко',
    email: 'a.honcharenko@univ.edu.ua',
    enrolledCourseIds: ['c-2', 'c-3'],
  },
  {
    id: 'usr-student-8',
    name: 'Ірина Савченко',
    email: 'i.savchenko@univ.edu.ua',
    enrolledCourseIds: ['c-2', 'c-3'],
  },
];

/** user → group. Існуючі записи не перезаписуються. */
const DEMO_ENROLLMENTS = [
  { id: 'enr-student-2', userId: 'usr-student-2', groupId: 'g-1', studentName: 'Марина Шевченко' },
  { id: 'enr-student-3', userId: 'usr-student-3', groupId: 'g-1', studentName: 'Ігор Бондаренко' },
  { id: 'enr-student-4', userId: 'usr-student-4', groupId: 'g-2', studentName: 'Софія Мельник' },
  { id: 'enr-student-5', userId: 'usr-student-5', groupId: 'g-2', studentName: 'Назар Кравчук' },
  { id: 'enr-student-6', userId: 'usr-student-6', groupId: 'g-3', studentName: 'Юлія Ткаченко' },
  { id: 'enr-student-7', userId: 'usr-student-7', groupId: 'g-3', studentName: 'Артем Гончаренко' },
  { id: 'enr-student-8', userId: 'usr-student-8', groupId: 'g-3', studentName: 'Ірина Савченко' },
];

/** Роботи, які чекають перевірки викладача. */
const DEMO_SUBMISSIONS_EXTRA = [
  {
    id: 'sub-2',
    assignmentId: 'asg-1',
    studentId: 'usr-student-2',
    studentName: 'Марина Шевченко',
    group: 'ІПЗ-412',
    submittedAt: daysAgo(2),
    fileName: 'Звіт_Лаб3_Шевченко_ІПЗ412.pdf',
    fileSize: '1.2 МБ',
    comment: 'Контракти REST API описано, додано приклади запитів і відповідей.',
    status: 'READY_FOR_GRADING',
    score: null,
  },
  {
    id: 'sub-3',
    assignmentId: 'asg-1',
    studentId: 'usr-student-3',
    studentName: 'Ігор Бондаренко',
    group: 'ІПЗ-412',
    submittedAt: daysAgo(1),
    fileName: 'Звіт_Лаб3_Бондаренко_ІПЗ412.pdf',
    fileSize: '1.6 МБ',
    comment: 'Реалізовано модуль взаємодії курсів та оцінювання, є тести.',
    status: 'READY_FOR_GRADING',
    score: null,
  },
  {
    id: 'sub-4',
    assignmentId: 'asg-3',
    studentId: 'usr-student-4',
    studentName: 'Софія Мельник',
    group: 'ІПЗ-411',
    submittedAt: daysAgo(3),
    fileName: 'Макет_Практ2_Мельник_ІПЗ411.pdf',
    fileSize: '2.1 МБ',
    comment: 'Інтерактивний прототип навчального кабінету у Figma, посилання у звіті.',
    status: 'READY_FOR_GRADING',
    score: null,
  },
  {
    id: 'sub-5',
    assignmentId: 'asg-2',
    studentId: 'usr-student-5',
    studentName: 'Назар Кравчук',
    group: 'ІПЗ-411',
    submittedAt: daysAgo(1),
    fileName: 'Лаб4_Кравчук_ІПЗ411.pdf',
    fileSize: '1.3 МБ',
    comment: 'Strategy та Decorator реалізовано, додано модульні тести.',
    status: 'READY_FOR_GRADING',
    score: null,
  },
];

/** Уже перевірені роботи — наповнюють журнал і відомості. */
const DEMO_SUBMISSIONS_GRADED = [
  {
    id: 'sub-prev-3',
    assignmentId: 'asg-prev-1',
    studentId: 'usr-student-2',
    studentName: 'Марина Шевченко',
    group: 'ІПЗ-412',
    submittedAt: daysAgo(22),
    fileName: 'Звіт_Лаб2_Шевченко_ІПЗ412.pdf',
    fileSize: '1.0 МБ',
    comment: 'Межі модулів описано, контракти взаємодії додано.',
    status: 'GRADED',
    score: 88,
  },
  {
    id: 'sub-prev-4',
    assignmentId: 'asg-prev-2',
    studentId: 'usr-student-4',
    studentName: 'Софія Мельник',
    group: 'ІПЗ-411',
    submittedAt: daysAgo(21),
    fileName: 'Практична_1_Мельник_ІПЗ411.pdf',
    fileSize: '0.8 МБ',
    comment: 'Проаналізовано навігацію трьох платформ.',
    status: 'GRADED',
    score: 92,
  },
  {
    id: 'sub-prev-5',
    assignmentId: 'asg-prev-1',
    studentId: 'usr-student-6',
    studentName: 'Юлія Ткаченко',
    group: 'КН-301',
    submittedAt: daysAgo(23),
    fileName: 'Звіт_Лаб2_Ткаченко_КН301.pdf',
    fileSize: '1.1 МБ',
    comment: 'Декомпозицію виконано, тести додано.',
    status: 'GRADED',
    score: 78,
  },
  {
    id: 'sub-prev-6',
    assignmentId: 'asg-prev-2',
    studentId: 'usr-student-7',
    studentName: 'Артем Гончаренко',
    group: 'КН-301',
    submittedAt: daysAgo(20),
    fileName: 'Практична_1_Гончаренко_КН301.pdf',
    fileSize: '0.9 МБ',
    comment: 'Запропоновано власну схему навігації.',
    status: 'GRADED',
    score: 85,
  },
  {
    id: 'sub-prev-7',
    assignmentId: 'asg-prev-1',
    studentId: 'usr-student-3',
    studentName: 'Ігор Бондаренко',
    group: 'ІПЗ-412',
    submittedAt: daysAgo(24),
    fileName: 'Звіт_Лаб2_Бондаренко_ІПЗ412.pdf',
    fileSize: '1.5 МБ',
    comment: 'Повна декомпозиція з діаграмами залежностей.',
    status: 'GRADED',
    score: 91,
  },
];

const DEMO_GRADES_EXTRA = [
  {
    id: 'grd-3',
    assignmentId: 'asg-prev-1',
    submissionId: 'sub-prev-3',
    studentId: 'usr-student-2',
    studentName: 'Марина Шевченко',
    group: 'ІПЗ-412',
    courseTitle: 'Архітектура програмного забезпечення',
    assignmentTitle: 'Лабораторна робота 2: Декомпозиція модулів системи',
    gradedAt: daysAgo(18),
    rawScore: 88,
    finalScore: 88,
    maxScore: 100,
    rule: 'STANDARD',
    criteriaScores: { clean_arch: 31, patterns: 32, tests: 25 },
    feedback: 'Добрий поділ на модулі, варто детальніше описати контракти взаємодії.',
  },
  {
    id: 'grd-4',
    assignmentId: 'asg-prev-2',
    submissionId: 'sub-prev-4',
    studentId: 'usr-student-4',
    studentName: 'Софія Мельник',
    group: 'ІПЗ-411',
    courseTitle: 'Основи вебдизайну та ергономіка UX/UI',
    assignmentTitle: 'Практична робота 1: Аналіз патернів навігації',
    gradedAt: daysAgo(17),
    rawScore: 92,
    finalScore: 92,
    maxScore: 100,
    rule: 'STANDARD',
    criteriaScores: { clean_arch: 38, patterns: 32, tests: 22 },
    feedback: 'Акуратна схема навігації та вдала колористика.',
  },
  {
    id: 'grd-5',
    assignmentId: 'asg-prev-1',
    submissionId: 'sub-prev-5',
    studentId: 'usr-student-6',
    studentName: 'Юлія Ткаченко',
    group: 'КН-301',
    courseTitle: 'Архітектура програмного забезпечення',
    assignmentTitle: 'Лабораторна робота 2: Декомпозиція модулів системи',
    gradedAt: daysAgo(19),
    rawScore: 78,
    finalScore: 78,
    maxScore: 100,
    rule: 'STANDARD',
    criteriaScores: { clean_arch: 28, patterns: 27, tests: 23 },
    feedback: 'Базова декомпозиція правильна; тестів поки недостатньо.',
  },
  {
    id: 'grd-6',
    assignmentId: 'asg-prev-2',
    submissionId: 'sub-prev-6',
    studentId: 'usr-student-7',
    studentName: 'Артем Гончаренко',
    group: 'КН-301',
    courseTitle: 'Основи вебдизайну та ергономіка UX/UI',
    assignmentTitle: 'Практична робота 1: Аналіз патернів навігації',
    gradedAt: daysAgo(16),
    rawScore: 85,
    finalScore: 90,
    maxScore: 100,
    rule: 'EXCELLENCE_BONUS',
    criteriaScores: { clean_arch: 34, patterns: 30, tests: 21 },
    feedback: 'Оригінальна схема навігації, бонус за якісну презентацію.',
  },
  {
    id: 'grd-7',
    assignmentId: 'asg-prev-1',
    submissionId: 'sub-prev-7',
    studentId: 'usr-student-3',
    studentName: 'Ігор Бондаренко',
    group: 'ІПЗ-412',
    courseTitle: 'Архітектура програмного забезпечення',
    assignmentTitle: 'Лабораторна робота 2: Декомпозиція модулів системи',
    gradedAt: daysAgo(15),
    rawScore: 91,
    finalScore: 91,
    maxScore: 100,
    rule: 'STANDARD',
    criteriaScores: { clean_arch: 33, patterns: 32, tests: 26 },
    feedback: 'Ґрунтовна робота з діаграмами залежностей.',
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

    await this.ensureDemoRoster();
  }

  /**
   * Доганяє демо-склад для вже існуючих БД: нові студенти, зарахування,
   * здачі, оцінки, куратори та лічильники груп. Нічого не дублює.
   */
  private async ensureDemoRoster() {
    const studentRepo = this.dataSource.getRepository(StudentEntity);
    const enrollmentRepo = this.dataSource.getRepository(EnrollmentEntity);
    const submissionRepo = this.dataSource.getRepository(SubmissionEntity);
    const gradeRepo = this.dataSource.getRepository(GradeEntity);
    const groupRepo = this.dataSource.getRepository(AcademicGroupEntity);

    for (const student of DEMO_STUDENTS) {
      const exists = await studentRepo.findOne({ where: { id: student.id } });
      if (!exists) await studentRepo.save(studentRepo.create(student));
    }

    for (const enrollment of DEMO_ENROLLMENTS) {
      const exists = await enrollmentRepo.findOne({ where: { userId: enrollment.userId } });
      if (!exists) await enrollmentRepo.save(enrollmentRepo.create(enrollment));
    }

    for (const submission of [...DEMO_SUBMISSIONS_EXTRA, ...DEMO_SUBMISSIONS_GRADED]) {
      const exists = await submissionRepo.findOne({
        where: [
          { id: submission.id },
          { assignmentId: submission.assignmentId, studentId: submission.studentId },
        ],
      });
      if (!exists) await submissionRepo.save(submissionRepo.create(submission));
    }

    for (const grade of DEMO_GRADES_EXTRA) {
      const exists = await gradeRepo.findOne({
        where: [{ id: grade.id }, { submissionId: grade.submissionId }],
      });
      if (!exists) await gradeRepo.save(gradeRepo.create(grade));
    }

    const groups = await groupRepo.find();
    const enrollments = await enrollmentRepo.find();
    const demoCurators: Record<string, string> = {
      'g-2': 'usr-teacher-2',
      'g-3': 'usr-teacher-3',
    };

    for (const group of groups) {
      const members = enrollments.filter((item) => item.groupId === group.id);
      const names = members.map((item) => item.studentName).filter(Boolean);
      const nextCount = members.length;
      const curator = demoCurators[group.id];
      const needsUpdate =
        group.studentsCount !== nextCount ||
        JSON.stringify(group.studentsList || []) !== JSON.stringify(names) ||
        (curator && !group.curatorId);

      if (!needsUpdate) continue;
      group.studentsCount = nextCount;
      group.studentsList = names;
      if (curator && !group.curatorId) group.curatorId = curator;
      await groupRepo.save(group);
    }

    this.logger.log('Demo roster ensured (students, enrollments, submissions, grades, curators)');
  }
}
