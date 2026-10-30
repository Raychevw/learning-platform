// ============================================================================
//  Демонстрационные данные (offline seed).
//  Используются как fallback, когда backend недоступен, и как первичное
//  наполнение БД сервисов (см. catalog.seeder.ts / coursework.seeder.ts).
// ============================================================================
export const LECTURE_SLIDES = [
  {
    slideNum: 1,
    tag: 'Модуль 2 • Поведінкові патерни GoF',
    title: 'Патерн проектування Strategy (Стратегія)',
    points: [
      'Відокремлення алгоритмів розрахунку від основного бізнес-контексту сервісу',
      'Заміна складних умовних конструкцій if/else на поліморфні класи стратегій',
      'Можливість перемикання алгоритму під час виконання програми (Runtime)',
    ],
    code: `interface GradingStrategy {
  calculate(rawScore: number, maxScore: number): number;
}`,
  },
  {
    slideNum: 2,
    tag: 'Практична реалізація • Чиста архітектура',
    title: 'Інкапсуляція правил оцінювання робіт',
    points: [
      'StandardGradingStrategy — базовий розрахунок балів за критеріями рубрики',
      'LatePenaltyStrategy — автоматичне застосування коефіцієнта 0.8 при простроченні',
      'ExcellenceBonusStrategy — нарахування +5 бонусних балів за високу якість коду',
    ],
    code: `class LatePenaltyStrategy implements GradingStrategy {
  calculate(raw: number, max: number): number {
    return Math.min(max, Math.round(raw * 0.8 * 10) / 10);
  }
}`,
  },
  {
    slideNum: 3,
    tag: 'Принципи SOLID • Open/Closed Principle',
    title: 'Переваги для тестування та масштабування',
    points: [
      'Нові правила додаються без модифікації існуючого коду сервісу перевірки робіт',
      'Кожна стратегія покривається ізольованими Unit-тестами за мілісекунди',
      'Відсутність побічних ефектів при зміні регламенту семестрового контролю',
    ],
    code: `const context = new SubmissionGrader(new ExcellenceBonusStrategy());
const finalScore = context.evaluate(submission); // 99 / 100 (ECTS: A)`,
  },
  {
    slideNum: 4,
    tag: 'Підсумки заняття та Q&A',
    title: 'Вимоги до захисту Лабораторної роботи №4',
    points: [
      'Реалізувати щонайменше 3 власні класи стратегій у доменному шарі проекту',
      'Налаштувати діаграму класів UML та додати її у PDF-звіт',
      'Завантажити архів або PDF-звіт у розділі «Завдання» до встановленого дедлайну',
    ],
    code: `// Успішного виконання лабораторної роботи!
// Запитання можна ставити у чаті трансляції або голосом (Підняти руку)`,
  },
];

export const INITIAL_COURSES = [
  {
    id: 'c-1',
    title: 'Архітектура програмного забезпечення',
    instructor: 'Дмитро Коваленко, доц.',
    description: 'Чиста архітектура, патерни проектування GoF, принципи SOLID та побудова сучасних веб-систем.',
    semester: 7,
    modulesCount: 2,
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
            completed: true,
            content:
              'У чистій архітектурі бізнес-логіка знаходиться в центрі системи та не залежить від бази даних чи зовнішніх бібліотек. Усі залежності спрямовані всередину до доменної моделі.',
          },
          {
            id: 'l-2',
            title: 'Методичні вказівки до виконання лабораторних робіт',
            type: 'Методичка',
            completed: true,
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
            completed: false,
            content:
              'Розгляд гнучкого вибору алгоритмів під час виконання програми на прикладі розрахунку рейтингових балів студентів.',
          },
          {
            id: 'l-4',
            title: 'Презентація: Побудова складних об’єктів через Builder',
            type: 'Презентація',
            completed: false,
            content:
              'Покрокове конструювання об’єктів навчальних завдань із критеріями оцінювання та термінами здачі.',
          },
        ],
      },
    ],
    progress: 50,
  },
  {
    id: 'c-2',
    title: 'Основи вебдизайну та ергономіка UX/UI',
    instructor: 'Олена Грищенко, ст. викл.',
    description: 'Проєктування інтерфейсів, доступність, типографіка та компонування сучасних освітніх платформ.',
    semester: 7,
    modulesCount: 1,
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
            completed: true,
            content:
              'Правильно підібрана сітка та візуальні акценти дозволяють користувачу швидко знаходити потрібні розділи без зайвого візуального шуму.',
          },
          {
            id: 'l-6',
            title: 'Практикум: Інтерактивне прототипування у Figma',
            type: 'Методичка',
            completed: false,
            content:
              'Побудова адаптивних компонентів карток курсів, таблиць журналу та модальних вікон.',
          },
        ],
      },
    ],
    progress: 50,
  },
  {
    id: 'c-3',
    title: 'Математичні методи дослідження операцій',
    instructor: 'Василь Мельник, проф.',
    description: 'Теорія графів, симплекс-метод, оптимізаційні алгоритми та моделювання систем.',
    semester: 7,
    modulesCount: 1,
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
            completed: false,
            content:
              'Канонічна та стандартна форми задачі лінійного програмування. Геометрична інтерпретація допустимих розв’язків.',
          },
        ],
      },
    ],
    progress: 0,
  },
];

export const INITIAL_ASSIGNMENTS = [
  {
    id: 'asg-1',
    courseId: 'c-1',
    courseTitle: 'Архітектура програмного забезпечення',
    title: 'Лабораторна робота 3: Проектування REST API та взаємодії модулів',
    description: 'Спроектувати контракти взаємодії між модулями курсів та оцінювання.',
    type: 'Лабораторна',
    deadline: '2026-10-18T23:59:00.000Z',
    maxScore: 100,
    rubricTitle: 'Чиста архітектура (3 критерії)',
    criteria: [
      { id: 'clean_arch', name: 'Чиста архітектура та поділ шарів', max: 35 },
      { id: 'patterns', name: 'Правильність застосування патернів', max: 35 },
      { id: 'tests', name: 'Покриття модульними тестами', max: 30 },
    ],
    submissions: [
      {
        id: 'sub-1',
        studentId: 'usr-student',
        studentName: 'Олександр Петренко',
        group: 'ІПЗ-412',
        submittedAt: '2026-10-14T12:30:00.000Z',
        fileName: 'Звіт_Лаб3_Петренко_ІПЗ412.pdf',
        fileSize: '1.4 МБ',
        comment: 'Виконано відповідно до методичних вказівок. Посилання на репозиторій додано у звіт.',
        status: 'READY_FOR_GRADING',
        score: null,
      },
    ],
  },
  {
    id: 'asg-2',
    courseId: 'c-1',
    courseTitle: 'Архітектура програмного забезпечення',
    title: 'Лабораторна робота 4: Патерни Decorator та Strategy',
    description: 'Реалізувати гнучкий розрахунок підсумкових балів та кешування даних.',
    type: 'Лабораторна',
    deadline: '2026-10-24T23:59:00.000Z',
    maxScore: 100,
    rubricTitle: 'Шаблони проектування GoF',
    criteria: [
      { id: 'clean_arch', name: 'Реалізація патерна Strategy', max: 40 },
      { id: 'patterns', name: 'Реалізація патерна Decorator', max: 35 },
      { id: 'tests', name: 'Модульні тести та висновки', max: 25 },
    ],
    submissions: [],
  },
  {
    id: 'asg-3',
    courseId: 'c-2',
    courseTitle: 'Основи вебдизайну та ергономіка UX/UI',
    title: 'Практична робота 2: Макет навчального кабінету',
    description: 'Розробити інтерактивний дизайн-прототип системи навчання.',
    type: 'Практична',
    deadline: '2026-10-28T23:59:00.000Z',
    maxScore: 100,
    rubricTitle: 'Ергономіка та дизайн',
    criteria: [
      { id: 'clean_arch', name: 'Компонування та модульна сітка', max: 40 },
      { id: 'patterns', name: 'Колористика та типографіка', max: 35 },
      { id: 'tests', name: 'Зручність навігації', max: 25 },
    ],
    submissions: [],
  },
];

export const INITIAL_GRADES = [
  {
    id: 'grd-1',
    assignmentId: 'asg-prev-1',
    submissionId: 'sub-prev-1',
    studentId: 'usr-student',
    studentName: 'Олександр Петренко',
    group: 'ІПЗ-412',
    courseTitle: 'Архітектура програмного забезпечення',
    assignmentTitle: 'Лабораторна робота 2: Декомпозиція модулів системи',
    submittedAt: '10 жовтня 2026',
    rawScore: 95,
    finalScore: 95,
    maxScore: 100,
    rule: 'STANDARD',
    ruleDesc: 'Стандартний розрахунок',
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
    submittedAt: '11 жовтня 2026',
    rawScore: 92,
    finalScore: 97,
    maxScore: 100,
    rule: 'EXCELLENCE_BONUS',
    ruleDesc: 'Заохочувальний бонус (+5 балів)',
    feedback: 'Гарна колористика та якісне компонування інтерфейсу.',
  },
];

export const INITIAL_GROUPS = [
  {
    id: 'g-1',
    name: 'ІПЗ-412',
    faculty: 'ФІОТ',
    studyYear: 4,
    studentsCount: 0,
    assignedCourseIds: ['c-1', 'c-2', 'c-3'],
    studentsList: [],
  },
  {
    id: 'g-2',
    name: 'ІПЗ-411',
    faculty: 'ФІОТ',
    studyYear: 4,
    studentsCount: 0,
    assignedCourseIds: ['c-1', 'c-2'],
    studentsList: [],
  },
  {
    id: 'g-3',
    name: 'КН-301',
    faculty: 'ФІОТ',
    studyYear: 3,
    studentsCount: 0,
    assignedCourseIds: ['c-2', 'c-3'],
    studentsList: [],
  },
];

export const INITIAL_WEBINARS = [
  {
    id: 'web-1',
    courseId: 'c-1',
    courseTitle: 'Архітектура програмного забезпечення',
    title: 'Онлайн-лекція: Чиста архітектура та інверсія залежностей',
    instructor: 'Дмитро Коваленко, доц.',
    scheduledAt: '2026-10-16T18:00:00.000Z',
    status: 'LIVE',
    chat: [],
  },
  {
    id: 'web-2',
    courseId: 'c-2',
    courseTitle: 'Основи вебдизайну та ергономіка UX/UI',
    title: 'Практичний семінар: Розбір макетів студентських робіт',
    instructor: 'Олена Грищенко, ст. викл.',
    scheduledAt: '2026-10-21T14:30:00.000Z',
    status: 'SCHEDULED',
    chat: [],
  },
];

export const INITIAL_AUDIT_LOGS = [
  {
    id: 'log-1',
    userId: 'Олександр Петренко (ІПЗ-412)',
    ip: '192.168.1.45',
    action: 'Завантаження звіту лабораторної роботи №3',
    resource: 'Архітектура ПЗ',
    status: 'ALLOWED',
    time: '14.10.2026 12:30',
  },
  {
    id: 'log-2',
    userId: 'Дмитро Коваленко, доц.',
    ip: '192.168.1.10',
    action: 'Оновлення робочої програми дисципліни',
    resource: 'Архітектура ПЗ',
    status: 'ALLOWED',
    time: '14.10.2026 14:02',
  },
  {
    id: 'log-3',
    userId: 'Олена Франчук (Деканат)',
    ip: '192.168.1.5',
    action: 'Затвердження навчального плану групи ІПЗ-412',
    resource: 'Деканат ФІОТ',
    status: 'ALLOWED',
    time: '15.10.2026 10:15',
  },
];

export const INITIAL_EVENTS = [
  {
    id: 'ev-1',
    type: 'grade',
    title: 'Виставлено 97 балів (ECTS: A)',
    desc: 'Основи вебдизайну — Практична робота №1.',
    time: 'Нещодавно',
  },
  {
    id: 'ev-2',
    type: 'course',
    title: 'Триває онлайн-лекція',
    desc: 'Архітектура ПЗ: Чиста архітектура та інверсія залежностей.',
    time: 'Сьогодні о 18:00',
  },
];
