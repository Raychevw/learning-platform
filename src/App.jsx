import { useState, useEffect } from 'react';
import './App.css';

const SSO_ACCOUNTS = [
  {
    id: 'usr-student',
    name: 'Олександр Петренко',
    email: 'o.petrenko@univ.edu.ua',
    role: 'student',
    dept: 'Група «ІПЗ-412» • 4 курс',
    initials: 'ОП',
    desc: 'Кабінет студента: перегляд силабусу, здача лабораторних робіт, перевірка плагіату та особистий щоденник успішності',
  },
  {
    id: 'usr-teacher',
    name: 'Дмитро Коваленко, доц.',
    email: 'd.kovalenko@univ.edu.ua',
    role: 'teacher',
    dept: 'Кафедра інженерії ПЗ',
    initials: 'ДК',
    desc: 'Кабінет викладача: силабус, додавання модулів/файлів, перевірка та оцінювання за рубриками',
  },
  {
    id: 'usr-admin',
    name: 'Олена Франчук',
    email: 'dekanat.fiot@univ.edu.ua',
    role: 'admin',
    dept: 'Деканат ФІОТ / ІТ-відділ',
    initials: 'ОФ',
    desc: 'Кабінет адміністратора: формування академічних груп, дисциплін, навантаження та аудит безпеки',
  },
];

export default function App() {
  // Current Authenticated User (Strictly locked to SSO session - no random switching)
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const stored = localStorage.getItem('studevo_auth_user');
      return stored ? JSON.parse(stored) : SSO_ACCOUNTS[0];
    } catch {
      return SSO_ACCOUNTS[0];
    }
  });

  const userRole = currentUser ? currentUser.role : 'student';
  const [activeMenu, setActiveMenu] = useState('dashboard');

  const handleSsoLogin = async (account) => {
    try {
      await fetch('http://localhost:3000/auth/sso/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: account.email,
          full_name: account.name,
          role: account.role.toUpperCase(),
        }),
      }).catch(() => null);
    } catch (e) {
      console.warn('Backend SSO login notify:', e);
    }

    setCurrentUser(account);
    localStorage.setItem('studevo_auth_user', JSON.stringify(account));
    setActiveMenu('dashboard');
    setNotification({ text: `Успішний вхід через SSO: ${account.name} (${account.dept})`, isError: false });
  };

  const handleLogout = () => {
    localStorage.removeItem('studevo_auth_user');
    setCurrentUser(null);
    setNotification({ text: 'Ви успішно вийшли з корпоративного облікового запису.', isError: false });
  };
  
  // Data states
  const [courses, setCourses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [academicGroups, setAcademicGroups] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [notification, setNotification] = useState(null);
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date(2026, 9, 1));
  
  // Forms & Interactive states
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupFaculty, setNewGroupFaculty] = useState('Факультет інформатики та обчислювальної техніки');
  const [newGroupYear, setNewGroupYear] = useState(4);
  const [newCourse, setNewCourse] = useState({ title: '', description: '', teacherId: '', semester: 7 });
  const [newAssignment, setNewAssignment] = useState({
    courseId: '',
    title: '',
    maxScore: 100,
    deadline: '2026-10-24T23:59',
    type: 'LAB',
  });
  const [submissionForm, setSubmissionForm] = useState({
    assignmentId: '',
    comment: 'Виконано відповідно до методичних вказівок. Посилання на репозиторій додано.',
    fileName: 'Звіт_Лабораторна_Петренко_ІПЗ412.pdf',
  });
  const [grading, setGrading] = useState({
    studentName: 'Олександр Петренко',
    submissionId: 'sub-1',
    rule: 'STANDARD',
    criteriaScores: {
      'clean_arch': 30,
      'patterns': 35,
      'tests': 25,
    },
    feedback: 'Архітектура відповідає принципам Clean Architecture. Патерни реалізовано коректно.',
  });
  const [gradingResult, setGradingResult] = useState(null);

  // Initial Seed Data for Higher Education University LMS
  const defaultCourses = [
    {
      id: 'c-1',
      title: 'Архітектура програмного забезпечення',
      instructor: 'Дмитро Коваленко, доц.',
      description: 'Чиста архітектура, патерни проектування GoF, принципи SOLID та побудова мікросервісів.',
      semester: 7,
      modulesCount: 4,
      totalHours: 120,
      isPublished: true,
      cover: '/course-coding.jpg',
      modules: [
        {
          id: 'm-1',
          title: 'Модуль 1: Принципи SOLID та Clean Architecture',
          lessons: [
            { id: 'l-1', title: 'Лекція 1: Огляд шарів домену та інфраструктури', type: 'TEXT', completed: true },
            { id: 'l-2', title: 'Методичні вказівки до лабораторного циклу', type: 'GUIDE', completed: true },
          ],
        },
        {
          id: 'm-2',
          title: 'Модуль 2: Породжуючі та поведінкові патерни (Builder, Strategy)',
          lessons: [
            { id: 'l-3', title: 'Відео-лекція: Патерн Strategy в оцінюванні', type: 'VIDEO', completed: false },
            { id: 'l-4', title: 'Презентація: Конструювання об’єктів через Builder', type: 'PRESENTATION', completed: false },
          ],
        },
      ],
      progress: 50,
    },
    {
      id: 'c-2',
      title: 'Основи вебдизайну та ергономіка UX/UI',
      instructor: 'Олена Грищенко, ст. викл.',
      description: 'Проєктування інтерфейсів, доступність WCAG, компонування сучасних LMS платформ.',
      semester: 7,
      modulesCount: 3,
      totalHours: 90,
      isPublished: true,
      cover: '/course-webdesign.jpg',
      modules: [
        {
          id: 'm-3',
          title: 'Модуль 1: Дизайн-системи та колористика',
          lessons: [
            { id: 'l-5', title: 'Лекція: Колірні схеми в академічних системах', type: 'TEXT', completed: true },
          ],
        },
      ],
      progress: 65,
    },
    {
      id: 'c-3',
      title: 'Математичні методи дослідження операцій',
      instructor: 'Василь Мельник, проф.',
      description: 'Теорія графів, оптимізаційні алгоритми та моделювання систем.',
      semester: 7,
      modulesCount: 3,
      totalHours: 120,
      isPublished: true,
      cover: '/course-math.jpg',
      modules: [],
      progress: 25,
    },
  ];

  const defaultAssignments = [
    {
      id: 'asg-1',
      courseTitle: 'Архітектура програмного забезпечення',
      title: 'Лабораторна робота 3: Контракти API та черги EDA',
      type: 'LAB',
      deadline: '2026-10-18T23:59:00.000Z',
      maxScore: 100,
      rubricTitle: 'Рубрика: Чиста архітектура (3 критерії)',
      criteria: [
        { id: 'clean_arch', name: 'Чиста архітектура та шари', max: 35 },
        { id: 'patterns', name: 'Правильність застосування патернів', max: 35 },
        { id: 'tests', name: 'Модульні тести (coverage > 80%)', max: 30 },
      ],
      submissions: [
        {
          id: 'sub-1',
          studentName: 'Олександр Петренко',
          group: 'ІПЗ-412',
          submittedAt: '2026-10-14T12:30:00.000Z',
          fileUrl: 'https://storage.univ.edu.ua/lms-files/lab3_petrenko.pdf',
          status: 'READY_FOR_GRADING',
          plagiarismScore: 94.5, // 94.5% unique
          plagiarismReportUrl: 'https://antiplagiat.univ.edu.ua/reports/sub-1',
          score: null,
        },
      ],
    },
    {
      id: 'asg-2',
      courseTitle: 'Архітектура програмного забезпечення',
      title: 'Лабораторна робота 4: Патерни Decorator та Strategy',
      type: 'LAB',
      deadline: '2026-10-24T23:59:00.000Z',
      maxScore: 100,
      rubricTitle: 'Рубрика: Шаблони GoF',
      criteria: [
        { id: 'strategy', name: 'Реалізація інтерфейсу Strategy', max: 50 },
        { id: 'decorator', name: 'Реалізація кешувального Decorator', max: 50 },
      ],
      submissions: [],
    },
  ];

  const defaultGroups = [
    { id: 'g-1', name: 'ІПЗ-412', faculty: 'ФІОТ', studyYear: 4, studentsCount: 28 },
    { id: 'g-2', name: 'ІПЗ-411', faculty: 'ФІОТ', studyYear: 4, studentsCount: 26 },
    { id: 'g-3', name: 'КН-301', faculty: 'ФІОТ', studyYear: 3, studentsCount: 30 },
  ];

  const defaultAuditLogs = [
    { id: 'log-1', userId: 'user-stud-12', ip: '192.168.1.45', action: 'SUBMISSION_FILE_UPLOAD', resource: '/assignments/asg-1/submit', status: 'ALLOWED', time: '14.10.2026 12:30:02' },
    { id: 'log-2', userId: 'user-stud-99', ip: '10.0.4.112', action: 'UNAUTHORIZED_GRADEBOOK_ACCESS', resource: '/grading/gradebook/student/user-stud-12', status: 'DENIED', time: '14.10.2026 13:15:20' },
    { id: 'log-3', userId: 'user-teacher-01', ip: '192.168.1.10', action: 'COURSE_SYLLABUS_UPDATE', resource: '/courses/c-1/publish', status: 'ALLOWED', time: '14.10.2026 14:02:11' },
    { id: 'log-4', userId: 'unknown', ip: '45.132.88.12', action: 'RBAC_TEACHER_ROLE_CHECK_FAILED', resource: '/courses/c-1/modules', status: 'DENIED', time: '14.10.2026 15:40:05' },
  ];

  useEffect(() => {
    setCourses(defaultCourses);
    setAssignments(defaultAssignments);
    setAcademicGroups(defaultGroups);
    setAuditLogs(defaultAuditLogs);
  }, []);

  const showNotification = (text, isError = false) => {
    setNotification({ text, isError });
    setTimeout(() => setNotification(null), 5000);
  };

  // Actions
  const handleCreateGroup = (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    const group = {
      id: `g-${Date.now()}`,
      name: newGroupName,
      faculty: newGroupFaculty,
      studyYear: Number(newGroupYear),
      studentsCount: 0,
    };
    setAcademicGroups((prev) => [group, ...prev]);
    showNotification(`Академічну групу «${newGroupName}» успішно зареєстровано в деканаті.`);
    setNewGroupName('');
  };

  const handleCreateCourse = (e) => {
    e.preventDefault();
    if (!newCourse.title.trim()) return;
    const course = {
      id: `c-${Date.now()}`,
      title: newCourse.title,
      instructor: 'Дмитро Коваленко, доц.',
      description: newCourse.description,
      semester: Number(newCourse.semester),
      modulesCount: 2,
      totalHours: 90,
      isPublished: false,
      cover: '/course-coding.jpg',
      modules: [],
      progress: 0,
    };
    setCourses((prev) => [course, ...prev]);
    showNotification(`Дисципліну «${newCourse.title}» збережено в каталозі.`);
    setNewCourse({ title: '', description: '', teacherId: '', semester: 7 });
  };

  const handlePublishCourse = (courseId) => {
    setCourses((prev) =>
      prev.map((c) => (c.id === courseId ? { ...c, isPublished: true } : c))
    );
    if (selectedCourse && selectedCourse.id === courseId) {
      setSelectedCourse((prev) => ({ ...prev, isPublished: true }));
    }
    showNotification('Дисципліну опубліковано. Силабус став доступним для студентів.');
  };

  const handleStudentSubmit = (e) => {
    e.preventDefault();
    showNotification(`Роботу «${submissionForm.fileName}» успішно завантажено в S3 та відправлено на перевірку антиплагіатом.`);
  };

  const handleGradeWithStrategy = (e) => {
    e.preventDefault();
    const sumRaw = Object.values(grading.criteriaScores).reduce((a, b) => Number(a) + Number(b), 0);
    let finalScore = sumRaw;
    let ruleDesc = 'Базовий розрахунок (Standard)';

    if (grading.rule === 'LATE_PENALTY') {
      finalScore = Math.round(sumRaw * 0.8 * 10) / 10;
      ruleDesc = 'LatePenalty (-20% за протермінований дедлайн)';
    } else if (grading.rule === 'EXCELLENCE_BONUS') {
      finalScore = sumRaw >= 90 ? Math.min(100, sumRaw + 5) : sumRaw;
      ruleDesc = 'ExcellenceBonus (+5 балів за відмінну якість)';
    }

    setGradingResult({
      studentName: grading.studentName,
      rawScore: sumRaw,
      finalScore,
      ruleDesc,
      feedback: grading.feedback,
    });
    showNotification(`Оцінку ${finalScore}/100 внесено в електронний журнал групи.`);
  };

  const calendarDays = [
    null, null, null,
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31
  ];
  const deadlineDays = [18, 24, 28];

  if (!currentUser) {
    return (
      <div className="sso-auth-overlay">
        <div className="sso-auth-card">
          <div className="sso-auth-header">
            <div className="sso-auth-logo">
              <span className="logo-icon">S</span>
              <span className="logo-title">STUDEVO</span>
            </div>
            <h2>Університетська система дистанційного навчання</h2>
            <p>
              Вхід дозволено виключно через єдиний корпоративний акаунт (Google Workspace / Microsoft 365 за протоколом OAuth2 / OIDC).
              Вільна реєстрація сторонніх користувачів закрита.
            </p>
          </div>

          <div className="sso-auth-body">
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#495057' }}>
              Оберіть ваш корпоративний обліковий запис університету (@univ.edu.ua):
            </div>

            <div className="sso-role-cards-grid">
              {SSO_ACCOUNTS.map((acc) => (
                <div
                  key={acc.id}
                  className="sso-account-card"
                  onClick={() => handleSsoLogin(acc)}
                >
                  <div className="sso-account-left">
                    <div className={`sso-account-avatar ${acc.role}`}>
                      {acc.initials}
                    </div>
                    <div className="sso-account-info">
                      <h4>{acc.name}</h4>
                      <div className="sso-email">{acc.email} • {acc.dept}</div>
                      <div className="sso-desc">{acc.desc}</div>
                    </div>
                  </div>
                  <button className="sso-login-btn">
                    Увійти через SSO →
                  </button>
                </div>
              ))}
            </div>

            <div className="sso-auth-footer">
              🔒 Платформа захищена системою доменних Guard-політик та SSO JWT. Усі сесії шифруються.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="studevo-app-shell">
      {/* ========================================================
          LEFT COLUMN (260px) - NAVIGATION & RBAC PROFILE
          ======================================================== */}
      <aside className="studevo-sidebar-nav">
        <div>
          {/* 1. Branding */}
          <div className="studevo-brand-block">
            <div className="studevo-brand-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"></path>
                <path d="M6 6h10"></path>
                <path d="M6 10h10"></path>
              </svg>
            </div>
            <div className="studevo-brand-text">
              <span className="studevo-brand-title">STUDEVO</span>
              <span className="studevo-brand-subtitle">Університетська LMS</span>
            </div>
          </div>

          {/* 2. Main Navigation Menu (Adapts by Role) */}
          <ul className="studevo-menu-list">
            <li>
              <button
                className={`studevo-menu-item ${activeMenu === 'dashboard' ? 'active' : ''}`}
                onClick={() => setActiveMenu('dashboard')}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect width="7" height="9" x="3" y="3" rx="1"></rect>
                  <rect width="7" height="5" x="14" y="3" rx="1"></rect>
                  <rect width="7" height="9" x="14" y="12" rx="1"></rect>
                  <rect width="7" height="5" x="3" y="16" rx="1"></rect>
                </svg>
                <span>Дашборд (Огляд)</span>
              </button>
            </li>

            <li>
              <button
                className={`studevo-menu-item ${activeMenu === 'courses' ? 'active' : ''}`}
                onClick={() => setActiveMenu('courses')}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                </svg>
                <span>Каталог курсів</span>
              </button>
            </li>

            <li>
              <button
                className={`studevo-menu-item ${activeMenu === 'assignments' ? 'active' : ''}`}
                onClick={() => setActiveMenu('assignments')}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 11l3 3L22 4"></path>
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                </svg>
                <span>{userRole === 'student' ? 'Мої завдання' : 'Завдання та роботи'}</span>
              </button>
            </li>

            <li>
              <button
                className={`studevo-menu-item ${activeMenu === 'grades' ? 'active' : ''}`}
                onClick={() => setActiveMenu('grades')}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" x2="18" y1="20" y2="10"></line>
                  <line x1="12" x2="12" y1="20" y2="4"></line>
                  <line x1="6" x2="6" y1="20" y2="14"></line>
                </svg>
                <span>{userRole === 'student' ? 'Електронний щоденник' : 'Журнал успішності'}</span>
              </button>
            </li>

            {/* Admin-only Navigation items */}
            {userRole === 'admin' && (
              <>
                <li>
                  <button
                    className={`studevo-menu-item ${activeMenu === 'groups' ? 'active' : ''}`}
                    onClick={() => setActiveMenu('groups')}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                      <circle cx="9" cy="7" r="4"></circle>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                    <span>Академічні групи</span>
                  </button>
                </li>
                <li>
                  <button
                    className={`studevo-menu-item ${activeMenu === 'audit' ? 'active' : ''}`}
                    onClick={() => setActiveMenu('audit')}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                    </svg>
                    <span>Аудит безпеки</span>
                  </button>
                </li>
              </>
            )}
          </ul>
        </div>

        {/* 3. User Profile & 3-Role Switcher */}
        <div className="studevo-profile-footer">
          <div className="studevo-profile-card">
            <div className="profile-avatar">
              {currentUser.initials}
            </div>
            <div className="profile-info">
              <span className="profile-name">{currentUser.name}</span>
              <span className="profile-dept">{currentUser.dept}</span>
              <div className="profile-meta-row">
                <span className={`user-role-badge ${currentUser.role}`}>
                  {currentUser.role === 'student' ? 'Студент' : currentUser.role === 'teacher' ? 'Викладач' : 'Деканат'}
                </span>
                <span style={{ fontSize: '10.5px', color: '#868e96' }}>{currentUser.email}</span>
              </div>
            </div>
          </div>

          {/* Secure Session Logout Button */}
          <button
            className="logout-action-btn"
            title="Завершити сесію та вийти з облікового запису"
            onClick={handleLogout}
          >
            <span>🚪</span>
            <span>Вийти з акаунту</span>
          </button>
        </div>
      </aside>

      {/* ========================================================
          CENTER COLUMN (1fr) - WORKSPACE
          ======================================================== */}
      <main className="studevo-workspace">
        {/* Notifications */}
        {notification && (
          <div className={`studevo-alert ${notification.isError ? 'studevo-alert-danger' : 'studevo-alert-success'}`}>
            <span>{notification.text}</span>
            <button
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
              onClick={() => setNotification(null)}
            >
              ✕
            </button>
          </div>
        )}

        {/* 1. DASHBOARD VIEW */}
        {activeMenu === 'dashboard' && (
          <>
            <section className="studevo-welcome-banner">
              <div className="welcome-text">
                <h1>
                  {userRole === 'student'
                    ? 'Вітаємо в системі, Олександре!'
                    : userRole === 'teacher'
                    ? 'Кабінет викладача: навчальний процес'
                    : 'Панель адміністратора деканату'}
                </h1>
                <p>
                  {userRole === 'student'
                    ? 'Ваш академічний розклад синхронізовано. Перевірте найближчі терміни здачі лабораторних.'
                    : userRole === 'teacher'
                    ? 'Керування силлабусами дисциплін, перевірка робіт на плагіат та виставлення оцінок.'
                    : 'Формування академічних груп, призначення дисциплін та моніторинг аудиту безпеки.'}
                </p>
              </div>

              <div className="banner-stats">
                <div className="stat-pill">
                  <div className="stat-pill-val">{courses.length}</div>
                  <div className="stat-pill-label">Дисципліни</div>
                </div>
                <div className="stat-pill">
                  <div className="stat-pill-val">{assignments.length}</div>
                  <div className="stat-pill-label">Завдання</div>
                </div>
                <div className="stat-pill">
                  <div className="stat-pill-val">{userRole === 'admin' ? academicGroups.length : '94.5'}</div>
                  <div className="stat-pill-label">{userRole === 'admin' ? 'Групи' : 'Сер. рейтинг'}</div>
                </div>
              </div>
            </section>

            {/* Active Courses Grid */}
            <section>
              <div className="section-header-row">
                <h2 className="section-title">
                  <span>Навчальні дисципліни семестру</span>
                </h2>
                <button
                  className="btn-studevo-outline"
                  onClick={() => setActiveMenu('courses')}
                >
                  Повний каталог курсів &rarr;
                </button>
              </div>

              <div className="courses-grid-cards">
                {courses.map((c) => (
                  <div
                    key={c.id}
                    className="course-academic-card"
                    onClick={() => setSelectedCourse(c)}
                  >
                    <div className="course-card-top-cover">
                      <img src={c.cover} alt={c.title} />
                      <span className="course-card-badge">
                        {c.isPublished ? 'Опубліковано' : 'Чернетка'}
                      </span>
                    </div>

                    <div className="course-card-content">
                      <div>
                        <h3 className="course-card-title">{c.title}</h3>
                        <div className="course-card-instructor">{c.instructor}</div>
                        <div className="course-card-syllabus-meta">
                          <span>{c.modulesCount} змістові модулі • {c.totalHours} год.</span>
                        </div>
                      </div>

                      {userRole === 'student' && (
                        <div className="course-card-progress-block">
                          <div className="progress-header">
                            <span>Прогрес виконання</span>
                            <span>{c.progress}%</span>
                          </div>
                          <div className="progress-track">
                            <div className="progress-bar-fill" style={{ width: `${c.progress}%` }}></div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {/* 2. COURSES & SYLLABUS MANAGEMENT */}
        {activeMenu === 'courses' && (
          <div>
            <div className="section-header-row">
              <h2 className="section-title">
                Каталог дисциплін та робочі програми (Силабуси)
              </h2>
            </div>

            {userRole === 'teacher' && (
              <div className="studevo-card" style={{ marginBottom: '20px' }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', color: 'var(--studevo-red-dark)' }}>
                  Створення нової навчальної дисципліни
                </h3>
                <form onSubmit={handleCreateCourse}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '14px' }}>
                    <div className="form-group-field">
                      <label>Назва дисципліни</label>
                      <input
                        type="text"
                        className="input-studevo-control"
                        placeholder="наприклад: Безпека програмних систем"
                        value={newCourse.title}
                        onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group-field">
                      <label>Семестр</label>
                      <input
                        type="number"
                        min="1"
                        max="12"
                        className="input-studevo-control"
                        value={newCourse.semester}
                        onChange={(e) => setNewCourse({ ...newCourse, semester: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div className="form-group-field">
                    <label>Анотація для силабусу</label>
                    <textarea
                      rows="2"
                      className="input-studevo-control"
                      placeholder="Опис цілей та очікуваних результатів навчання..."
                      value={newCourse.description}
                      onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })}
                      required
                    />
                  </div>
                  <button type="submit" className="btn-studevo-primary">
                    Зберегти курс
                  </button>
                </form>
              </div>
            )}

            <div className="courses-grid-cards">
              {courses.map((c) => (
                <div
                  key={c.id}
                  className="course-academic-card"
                  onClick={() => setSelectedCourse(c)}
                >
                  <div className="course-card-top-cover">
                    <img src={c.cover} alt={c.title} />
                    <span className="course-card-badge">
                      {c.isPublished ? 'Опубліковано' : 'Чернетка'}
                    </span>
                  </div>

                  <div className="course-card-content">
                    <div>
                      <h3 className="course-card-title">{c.title}</h3>
                      <div className="course-card-instructor">{c.instructor}</div>
                      <div className="course-card-syllabus-meta">
                        <span>{c.modulesCount} модулі • Семестр {c.semester}</span>
                      </div>
                      <p style={{ fontSize: '12px', color: '#6c757d', margin: '0 0 10px 0' }}>
                        {c.description}
                      </p>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <button
                        className="btn-studevo-outline"
                        style={{ fontSize: '11.5px', padding: '4px 10px' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCourse(c);
                        }}
                      >
                        Переглянути силабус
                      </button>

                      {userRole === 'teacher' && !c.isPublished && (
                        <button
                          className="btn-studevo-primary"
                          style={{ fontSize: '11.5px', padding: '4px 10px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePublishCourse(c.id);
                          }}
                        >
                          Опублікувати
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. ASSIGNMENTS & SUBMISSIONS */}
        {activeMenu === 'assignments' && (
          <div>
            <div className="section-header-row">
              <h2 className="section-title">
                {userRole === 'student' ? 'Мої завдання та здача робіт' : 'Контрольні завдання та перевірка робіт'}
              </h2>
            </div>

            {/* Teacher: Assignment Builder with Criteria Rubric */}
            {userRole === 'teacher' && (
              <div className="studevo-card" style={{ marginBottom: '20px' }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', color: 'var(--studevo-red-dark)' }}>
                  Створення завдання з критеріями оцінювання (AssignmentBuilder)
                </h3>
                <form onSubmit={(e) => { e.preventDefault(); showNotification('Завдання створено з рубрикою оцінювання.'); }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.5fr 1fr 1fr', gap: '14px' }}>
                    <div className="form-group-field">
                      <label>Дисципліна</label>
                      <select className="input-studevo-control">
                        {courses.map((c) => (
                          <option key={c.id}>{c.title}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group-field">
                      <label>Тема лабораторної/практичної</label>
                      <input type="text" className="input-studevo-control" placeholder="Лабораторна робота..." required />
                    </div>
                    <div className="form-group-field">
                      <label>Макс. бал</label>
                      <input type="number" className="input-studevo-control" defaultValue={100} required />
                    </div>
                    <div className="form-group-field">
                      <label>Суворий дедлайн</label>
                      <input type="datetime-local" className="input-studevo-control" defaultValue="2026-10-24T23:59" required />
                    </div>
                  </div>
                  <button type="submit" className="btn-studevo-primary">
                    Створити завдання з рубрикою
                  </button>
                </form>
              </div>
            )}

            {/* Student: Active Submissions Card */}
            {userRole === 'student' && (
              <div className="studevo-card" style={{ marginBottom: '20px', background: '#fff9f9', border: '1px solid #ffc9c9' }}>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '14.5px', color: 'var(--studevo-red-dark)' }}>
                  Форма здачі лабораторної роботи (Завантаження в S3)
                </h3>
                <form onSubmit={handleStudentSubmit}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '14px' }}>
                    <div className="form-group-field">
                      <label>Оберіть завдання</label>
                      <select className="input-studevo-control">
                        {assignments.map((a) => (
                          <option key={a.id}>{a.title} ({a.courseTitle})</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group-field">
                      <label>Файл звіту (PDF у MinIO S3)</label>
                      <input
                        type="text"
                        className="input-studevo-control"
                        value={submissionForm.fileName}
                        onChange={(e) => setSubmissionForm({ ...submissionForm, fileName: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="form-group-field">
                    <label>Коментар студента або посилання на GitHub репозиторій</label>
                    <input
                      type="text"
                      className="input-studevo-control"
                      value={submissionForm.comment}
                      onChange={(e) => setSubmissionForm({ ...submissionForm, comment: e.target.value })}
                    />
                  </div>
                  <button type="submit" className="btn-studevo-primary">
                    Відправити роботу на перевірку антиплагіатом
                  </button>
                </form>
              </div>
            )}

            {/* Assignments & Submissions Table */}
            <div className="studevo-card">
              <table className="studevo-table">
                <thead>
                  <tr>
                    <th>Тема завдання</th>
                    <th>Дисципліна</th>
                    <th>Дедлайн</th>
                    <th>Макс. бал</th>
                    <th>Рубрика</th>
                    {userRole === 'teacher' && <th>Антиплагіат</th>}
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((asg) => (
                    <tr key={asg.id}>
                      <td><strong>{asg.title}</strong></td>
                      <td style={{ color: 'var(--studevo-text-muted)' }}>{asg.courseTitle}</td>
                      <td>
                        <span style={{ color: 'var(--studevo-red-dark)', fontWeight: 600 }}>
                          {new Date(asg.deadline).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                      <td><strong>{asg.maxScore}</strong></td>
                      <td><span style={{ fontSize: '11.5px', color: '#495057' }}>{asg.rubricTitle}</span></td>
                      {userRole === 'teacher' && (
                        <td>
                          {asg.submissions.length > 0 ? (
                            <span className="badge-plagiarism">
                              {asg.submissions[0].plagiarismScore}% унікально
                            </span>
                          ) : (
                            <span style={{ color: '#adb5bd', fontSize: '11.5px' }}>Очікує робіт</span>
                          )}
                        </td>
                      )}
                      <td>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '10px',
                          fontSize: '11px',
                          fontWeight: 600,
                          backgroundColor: '#ebfbee',
                          color: '#2b8a3e',
                        }}>
                          {asg.submissions.length > 0 ? 'Здано на перевірку' : 'Активне'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. GRADES JOURNAL & RUBRIC EVALUATION */}
        {activeMenu === 'grades' && (
          <div>
            <div className="section-header-row">
              <h2 className="section-title">
                {userRole === 'student' ? 'Мій електронний щоденник та семестровий рейтинг' : 'Журнал успішності та оцінювання за рубриками'}
              </h2>
            </div>

            {/* Teacher View: Rubric Evaluation Form */}
            {userRole === 'teacher' && (
              <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: '22px' }}>
                <div className="studevo-card">
                  <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', color: 'var(--studevo-red-dark)' }}>
                    Оцінювання роботи за рубрикою (JSONB)
                  </h3>
                  <form onSubmit={handleGradeWithStrategy}>
                    <div className="form-group-field">
                      <label>Студент</label>
                      <input type="text" className="input-studevo-control" value="Олександр Петренко (ІПЗ-412)" disabled />
                    </div>

                    <div className="form-group-field">
                      <label>Перевірка на плагіат</label>
                      <div style={{ padding: '8px 12px', background: '#e7f5ff', borderRadius: '6px', fontSize: '12px', color: '#1971c2', fontWeight: 600 }}>
                        94.5% оригінальності (Звіт AntiPlagiat: успішно)
                      </div>
                    </div>

                    <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '8px', marginBottom: '14px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '8px', color: '#343a40' }}>Критерії рубрики:</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px' }}>
                        <span>Чиста архітектура (макс. 35):</span>
                        <input
                          type="number"
                          style={{ width: '60px', padding: '2px 6px' }}
                          value={grading.criteriaScores.clean_arch}
                          onChange={(e) => setGrading({
                            ...grading,
                            criteriaScores: { ...grading.criteriaScores, clean_arch: Number(e.target.value) },
                          })}
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px' }}>
                        <span>Патерни GoF (макс. 35):</span>
                        <input
                          type="number"
                          style={{ width: '60px', padding: '2px 6px' }}
                          value={grading.criteriaScores.patterns}
                          onChange={(e) => setGrading({
                            ...grading,
                            criteriaScores: { ...grading.criteriaScores, patterns: Number(e.target.value) },
                          })}
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                        <span>Тести &gt; 80% (макс. 30):</span>
                        <input
                          type="number"
                          style={{ width: '60px', padding: '2px 6px' }}
                          value={grading.criteriaScores.tests}
                          onChange={(e) => setGrading({
                            ...grading,
                            criteriaScores: { ...grading.criteriaScores, tests: Number(e.target.value) },
                          })}
                        />
                      </div>
                    </div>

                    <div className="form-group-field">
                      <label>Правило розрахунку (Патерн Strategy)</label>
                      <select
                        className="input-studevo-control"
                        value={grading.rule}
                        onChange={(e) => setGrading({ ...grading, rule: e.target.value })}
                      >
                        <option value="STANDARD">Standard — Базовий розрахунок за критеріями</option>
                        <option value="LATE_PENALTY">LatePenalty (-20%) — Штраф за порушення дедлайну</option>
                        <option value="EXCELLENCE_BONUS">ExcellenceBonus (+5%) — Заохочувальний бонус</option>
                      </select>
                    </div>

                    <div className="form-group-field">
                      <label>Текстовий фідбек викладача</label>
                      <textarea
                        rows="2"
                        className="input-studevo-control"
                        value={grading.feedback}
                        onChange={(e) => setGrading({ ...grading, feedback: e.target.value })}
                      />
                    </div>

                    <button type="submit" className="btn-studevo-primary" style={{ width: '100%' }}>
                      Зарахувати оцінку у відомість
                    </button>
                  </form>
                </div>

                {/* Grade Statement */}
                <div className="studevo-card">
                  <h3 style={{ margin: '0 0 14px 0', fontSize: '15px', color: 'var(--studevo-red-dark)' }}>
                    Відомість нарахування підсумкового балу
                  </h3>
                  {gradingResult ? (
                    <div style={{ background: '#fff5f5', border: '1px solid #ffe3e3', borderRadius: '10px', padding: '20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
                        <div>
                          <span style={{ fontSize: '11px', color: '#868e96', textTransform: 'uppercase' }}>Студент</span>
                          <div style={{ fontSize: '15px', fontWeight: 700 }}>{gradingResult.studentName}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '11px', color: '#868e96', textTransform: 'uppercase' }}>Застосоване правило</span>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--studevo-red-dark)' }}>
                            {gradingResult.ruleDesc}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '30px', margin: '16px 0', padding: '14px 0', borderTop: '1px dashed #fcc2d7', borderBottom: '1px dashed #fcc2d7' }}>
                        <div>
                          <span style={{ fontSize: '12px', color: '#6c757d' }}>Бали за критеріями:</span>
                          <div style={{ fontSize: '24px', fontWeight: 700, color: '#495057' }}>{gradingResult.rawScore}</div>
                        </div>
                        <div>
                          <span style={{ fontSize: '12px', color: '#6c757d' }}>Підсумковий бал у журнал:</span>
                          <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--studevo-red-dark)' }}>
                            {gradingResult.finalScore} / 100
                          </div>
                        </div>
                      </div>

                      <div style={{ fontSize: '12.5px', color: '#721c24' }}>
                        <strong>Коментар викладача:</strong> {gradingResult.feedback}
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: '40px 20px', textAlign: 'center', color: '#adb5bd', border: '1px dashed #dee2e6', borderRadius: '8px' }}>
                      Оберіть критерії та натисніть «Зарахувати оцінку у відомість».
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Student View: Electronic Gradebook */}
            {userRole === 'student' && (
              <div className="studevo-card">
                <table className="studevo-table">
                  <thead>
                    <tr>
                      <th>Навчальна дисципліна</th>
                      <th>Контрольне завдання</th>
                      <th>Дата здачі</th>
                      <th>Оцінка / Макс</th>
                      <th>Відсоток унікальності</th>
                      <th>Фідбек викладача</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>Архітектура ПЗ</strong></td>
                      <td>Лабораторна 3: Контракти API та EDA</td>
                      <td>14 жовтня 2026</td>
                      <td>
                        <strong style={{ color: 'var(--studevo-red-dark)', fontSize: '15px' }}>95</strong> / 100
                      </td>
                      <td>
                        <span className="badge-plagiarism">94.5% унікальності</span>
                      </td>
                      <td style={{ color: '#495057', fontSize: '12px' }}>
                        Відмінно реалізовано патерни Builder та Strategy. Зараховано ExcellenceBonus (+5%).
                      </td>
                    </tr>
                    <tr>
                      <td><strong>Основи вебдизайну</strong></td>
                      <td>Практична: Прототип кабінету Studevo</td>
                      <td>11 жовтня 2026</td>
                      <td>
                        <strong style={{ color: 'var(--studevo-red-dark)', fontSize: '15px' }}>48</strong> / 50
                      </td>
                      <td>
                        <span className="badge-plagiarism">98% унікальності</span>
                      </td>
                      <td style={{ color: '#495057', fontSize: '12px' }}>
                        Відмінна колористика та дотримання вимог WCAG.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 5. ADMIN VIEW: ACADEMIC GROUPS & DEAN'S OFFICE */}
        {activeMenu === 'groups' && userRole === 'admin' && (
          <div>
            <div className="section-header-row">
              <h2 className="section-title">
                Управління академічними групами (Деканат)
              </h2>
            </div>

            <div className="studevo-card" style={{ marginBottom: '20px' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', color: 'var(--studevo-red-dark)' }}>
                Формування нової академічної групи
              </h3>
              <form onSubmit={handleCreateGroup}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr 1fr', gap: '14px' }}>
                  <div className="form-group-field">
                    <label>Шифр групи</label>
                    <input
                      type="text"
                      className="input-studevo-control"
                      placeholder="наприклад: ІПЗ-412"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group-field">
                    <label>Факультет / Інститут</label>
                    <input
                      type="text"
                      className="input-studevo-control"
                      value={newGroupFaculty}
                      onChange={(e) => setNewGroupFaculty(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group-field">
                    <label>Курс навчання</label>
                    <input
                      type="number"
                      min="1"
                      max="6"
                      className="input-studevo-control"
                      value={newGroupYear}
                      onChange={(e) => setNewGroupYear(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <button type="submit" className="btn-studevo-primary">
                  Зареєструвати академічну групу
                </button>
              </form>
            </div>

            <div className="studevo-card">
              <table className="studevo-table">
                <thead>
                  <tr>
                    <th>Шифр групи</th>
                    <th>Факультет</th>
                    <th>Курс</th>
                    <th>Кількість студентів</th>
                    <th>Дії деканату</th>
                  </tr>
                </thead>
                <tbody>
                  {academicGroups.map((g) => (
                    <tr key={g.id}>
                      <td><strong>{g.name}</strong></td>
                      <td>{g.faculty}</td>
                      <td>{g.studyYear} курс</td>
                      <td>{g.studentsCount} студентів</td>
                      <td>
                        <button
                          className="btn-studevo-outline"
                          style={{ fontSize: '11.5px', padding: '4px 10px' }}
                          onClick={() => showNotification(`Студентів групи «${g.name}» підписано на семестрові дисципліни.`)}
                        >
                          Призначити дисципліни
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 6. ADMIN VIEW: SECURITY AUDIT LOGS */}
        {activeMenu === 'audit' && userRole === 'admin' && (
          <div>
            <div className="section-header-row">
              <h2 className="section-title">
                Журнал аудиту безпеки та доступу (audit_logs)
              </h2>
            </div>

            <div className="studevo-card">
              <p style={{ fontSize: '12.5px', color: 'var(--studevo-text-muted)', marginBottom: '14px' }}>
                Фіксує 100% спроб несанкціонованого доступу до чужих оцінок або даних протягом 1 секунди (Вимога безпеки 4).
              </p>
              <table className="studevo-table">
                <thead>
                  <tr>
                    <th>Час події</th>
                    <th>IP-адреса</th>
                    <th>Користувач ID</th>
                    <th>Дія (Action)</th>
                    <th>Цільовий ресурс</th>
                    <th>Статус безпеки</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td>{log.time}</td>
                      <td><code>{log.ip}</code></td>
                      <td>{log.userId}</td>
                      <td><strong>{log.action}</strong></td>
                      <td style={{ color: '#495057' }}><code>{log.resource}</code></td>
                      <td>
                        <span className={log.status === 'ALLOWED' ? 'badge-allowed' : 'badge-denied'}>
                          {log.status === 'ALLOWED' ? 'ДОЗВОЛЕНО' : 'ЗАБЛОКОВАНО (403)'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* ========================================================
          RIGHT COLUMN (340px) - ORGANIZER
          ======================================================== */}
      <aside className="studevo-organizer">
        {/* 1. Academic Calendar */}
        <div className="organizer-widget">
          <div className="organizer-widget-header">
            <h3 className="organizer-widget-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <rect width="18" height="18" x="3" y="4" rx="2" ry="2"></rect>
                <line x1="16" x2="16" y1="2" y2="6"></line>
                <line x1="8" x2="8" y1="2" y2="6"></line>
                <line x1="3" x2="21" y1="10" y2="10"></line>
              </svg>
              <span>Календар дедлайнів</span>
            </h3>

            <div className="calendar-month-nav">
              <button className="calendar-nav-btn">&lt;</button>
              <span>Жовтень 2026</span>
              <button className="calendar-nav-btn">&gt;</button>
            </div>
          </div>

          <div className="calendar-weekdays">
            <span>Пн</span>
            <span>Вт</span>
            <span>Ср</span>
            <span>Чт</span>
            <span>Пт</span>
            <span>Сб</span>
            <span>Нд</span>
          </div>

          <div className="calendar-grid-cells">
            {calendarDays.map((day, idx) => (
              <div
                key={idx}
                className={`cal-cell ${!day ? 'empty' : ''} ${day && deadlineDays.includes(day) ? 'deadline-highlight' : ''} ${day === 14 ? 'today' : ''}`}
                title={day && deadlineDays.includes(day) ? `Дедлайн здачі (${day} жовтня)` : ''}
              >
                {day || ''}
              </div>
            ))}
          </div>

          <div className="calendar-legend">
            <span className="legend-dot"></span>
            <span>Бордовим виділено дні здачі робіт</span>
          </div>
        </div>

        {/* 2. Upcoming Deadlines */}
        <div className="organizer-widget">
          <div className="organizer-widget-header">
            <h3 className="organizer-widget-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              <span>Найближчі дедлайни</span>
            </h3>
          </div>

          <div className="deadline-items-list">
            <div className="deadline-card-item">
              <div className="deadline-card-info">
                <div className="deadline-title">Лабораторна 3: Контракти API та EDA</div>
                <div className="deadline-course">Архітектура ПЗ • 100 балів</div>
                <span className="deadline-countdown-badge">залишилось 4 дні</span>
              </div>
            </div>

            <div className="deadline-card-item">
              <div className="deadline-card-info">
                <div className="deadline-title">Лабораторна 4: Патерни GoF</div>
                <div className="deadline-course">Архітектура ПЗ • 100 балів</div>
                <span className="deadline-countdown-badge">до 24 жовтня</span>
              </div>
            </div>

            <div className="deadline-card-item">
              <div className="deadline-card-info">
                <div className="deadline-title">Практична: Прототип кабінету Studevo</div>
                <div className="deadline-course">Основи вебдизайну • 50 балів</div>
                <span className="deadline-countdown-badge">до 28 жовтня</span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Recent Grades / Updates */}
        <div className="organizer-widget">
          <div className="organizer-widget-header">
            <h3 className="organizer-widget-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
              </svg>
              <span>Останні оцінки та події</span>
            </h3>
          </div>

          <div className="updates-list">
            <div className="update-card-item">
              <div className="update-icon-wrap grade">✓</div>
              <div className="update-content">
                <div className="update-header-text">Отримано 95 балів</div>
                <div className="update-desc-text">З курсу «Архітектура ПЗ» за схемою ExcellenceBonus (+5%).</div>
                <div className="update-time">2 години тому</div>
              </div>
            </div>

            <div className="update-card-item">
              <div className="update-icon-wrap course">★</div>
              <div className="update-content">
                <div className="update-header-text">Опубліковано новий курс</div>
                <div className="update-desc-text">«Безпека програмних систем» додано до розкладу групи.</div>
                <div className="update-time">Вчора о 16:30</div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* ========================================================
          COURSE SYLLABUS & LESSONS MODAL
          ======================================================== */}
      {selectedCourse && (
        <div className="modal-overlay" onClick={() => setSelectedCourse(null)}>
          <div className="modal-window" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{selectedCourse.title}</h3>
              <button
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }}
                onClick={() => setSelectedCourse(null)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div style={{ display: 'flex', gap: '16px', marginBottom: '18px' }}>
                <img
                  src={selectedCourse.cover}
                  alt={selectedCourse.title}
                  style={{ width: '130px', height: '85px', objectFit: 'cover', borderRadius: '8px' }}
                />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>
                    Викладач: {selectedCourse.instructor}
                  </div>
                  <div style={{ color: 'var(--studevo-text-muted)', fontSize: '12px', marginBottom: '6px' }}>
                    {selectedCourse.modulesCount} змістові модулі • {selectedCourse.totalHours} годин
                  </div>
                  <span style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: 600,
                    backgroundColor: selectedCourse.isPublished ? '#ebfbee' : '#fff5f5',
                    color: selectedCourse.isPublished ? '#2b8a3e' : '#c92a2a',
                  }}>
                    {selectedCourse.isPublished ? 'Опубліковано для студентів' : 'Чернетка'}
                  </span>
                </div>
              </div>

              <h4 style={{ margin: '14px 0 8px 0', fontSize: '14px', color: 'var(--studevo-red-dark)' }}>
                Структура змістових модулів та уроків:
              </h4>

              {selectedCourse.modules && selectedCourse.modules.length > 0 ? (
                selectedCourse.modules.map((m) => (
                  <div key={m.id} style={{ background: '#f8f9fa', borderRadius: '8px', padding: '12px', marginBottom: '10px' }}>
                    <div style={{ fontWeight: 700, fontSize: '13px', color: '#343a40', marginBottom: '6px' }}>{m.title}</div>
                    <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12.5px', color: '#495057' }}>
                      {m.lessons.map((l) => (
                        <li key={l.id} style={{ marginBottom: '4px' }}>
                          <span style={{ fontWeight: 500 }}>{l.title}</span>
                          <span style={{ marginLeft: '8px', fontSize: '10.5px', color: '#868e96', background: '#dee2e6', padding: '1px 6px', borderRadius: '4px' }}>
                            {l.type}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              ) : (
                <p style={{ color: '#6c757d', fontSize: '12.5px' }}>Модулі наповнюються викладачем.</p>
              )}

              <h4 style={{ margin: '14px 0 6px 0', fontSize: '14px', color: 'var(--studevo-red-dark)' }}>
                Анотація дисципліни:
              </h4>
              <p style={{ color: '#495057', margin: 0, fontSize: '13px', lineHeight: 1.5 }}>
                {selectedCourse.description}
              </p>
            </div>

            <div className="modal-footer">
              {userRole === 'teacher' && !selectedCourse.isPublished && (
                <button
                  className="btn-studevo-primary"
                  onClick={() => handlePublishCourse(selectedCourse.id)}
                >
                  Опублікувати дисципліну
                </button>
              )}
              <button
                className="btn-studevo-secondary"
                onClick={() => setSelectedCourse(null)}
              >
                Закрити
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
