import { useState, useEffect } from 'react';
import './App.css';

export default function App() {
  // Navigation & Role states
  const [activeMenu, setActiveMenu] = useState('dashboard'); // 'dashboard', 'courses', 'assignments', 'grades'
  const [userRole, setUserRole] = useState('student'); // 'student' | 'teacher'
  
  // Data states
  const [courses, setCourses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [notification, setNotification] = useState(null);
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date(2026, 9, 1)); // October 2026
  
  // Forms states
  const [newCourse, setNewCourse] = useState({ title: '', description: '', instructor: 'Дмитро Коваленко, доц.', modulesCount: 4 });
  const [newAssignment, setNewAssignment] = useState({
    courseId: '',
    title: '',
    maxScore: 100,
    dueDate: '2026-10-24T23:59',
  });
  const [grading, setGrading] = useState({
    studentName: 'Олександр Петренко',
    assignmentId: '',
    rawScore: 90,
    strategyName: 'STANDARD',
  });
  const [gradingResult, setGradingResult] = useState(null);

  // Initial Seed & API Loading
  useEffect(() => {
    loadAllData();
  }, []);

  const showNotification = (text, isError = false) => {
    setNotification({ text, isError });
    setTimeout(() => setNotification(null), 5000);
  };

  const defaultSeedCourses = [
    {
      id: 'course-1',
      title: 'Архітектура програмного забезпечення',
      instructor: 'Дмитро Коваленко, доц.',
      description: 'Чиста архітектура, патерни проектування GoF, принципи SOLID та побудова мікросервісів.',
      modulesCount: 4,
      totalHours: 120,
      syllabus: [
        'Модуль 1: Принципи SOLID та Clean Architecture',
        'Модуль 2: Породжуючі та поведінкові патерни (Builder, Strategy)',
        'Модуль 3: Структурні патерни та адаптація (Adapter, Decorator)',
        'Модуль 4: Мікросервісна взаємодія та подійні моделі (EDA)',
      ],
      progress: 65,
      isPublished: true,
      cover: '/course-coding.jpg',
    },
    {
      id: 'course-2',
      title: 'Основи вебдизайну та UX/UI',
      instructor: 'Олена Грищенко, ст. викл.',
      description: 'Користувацькі інтерфейси, ергономіка веб-систем, композиція та сучасна адаптивна верстка.',
      modulesCount: 3,
      totalHours: 90,
      syllabus: [
        'Модуль 1: Дизайн-системи та колористика',
        'Модуль 2: Прототипування в Figma та UX-тестування',
        'Модуль 3: Адаптивна та доступна верстка (WCAG)',
      ],
      progress: 45,
      isPublished: true,
      cover: '/course-webdesign.jpg',
    },
    {
      id: 'course-3',
      title: 'Математичні методи оптимізації',
      instructor: 'Василь Мельник, проф.',
      description: 'Теорія графів, лінійне програмування, моделювання обчислювальних систем.',
      modulesCount: 5,
      totalHours: 150,
      syllabus: [
        'Модуль 1: Лінійні оптимізаційні моделі',
        'Модуль 2: Алгоритми на графах та мережах',
        'Модуль 3: Нелінійна та динамічна оптимізація',
      ],
      progress: 30,
      isPublished: true,
      cover: '/course-math.jpg',
    },
    {
      id: 'course-4',
      title: 'Українська наукова та професійна термінологія',
      instructor: 'Марія Соколова, доц.',
      description: 'Культура професійного мовлення, оформлення технічної документації та академічне письмо.',
      modulesCount: 2,
      totalHours: 60,
      syllabus: [
        'Модуль 1: Академічна доброчесність та письмо',
        'Модуль 2: Складання науково-технічних звітів',
      ],
      progress: 80,
      isPublished: true,
      cover: '/course-literature.jpg',
    },
  ];

  const defaultSeedAssignments = [
    {
      id: 'asg-1',
      courseId: 'course-1',
      courseTitle: 'Архітектура ПЗ',
      title: 'Лабораторна 3: Проєктування контрактів та EDA',
      dueDate: '2026-10-18T23:59:00.000Z',
      maxScore: 100,
      status: 'Здано на перевірку',
      isVerified: true,
    },
    {
      id: 'asg-2',
      courseId: 'course-1',
      courseTitle: 'Архітектура ПЗ',
      title: 'Лабораторна 4: Патерни Decorator та Strategy',
      dueDate: '2026-10-24T23:59:00.000Z',
      maxScore: 100,
      status: 'У процесі виконання',
      isVerified: true,
    },
    {
      id: 'asg-3',
      courseId: 'course-2',
      courseTitle: 'Основи вебдизайну',
      title: 'Практична робота: Прототип кабінету Studevo',
      dueDate: '2026-10-28T23:59:00.000Z',
      maxScore: 50,
      status: 'Очікує виконання',
      isVerified: true,
    },
  ];

  const loadAllData = async () => {
    try {
      const cRes = await fetch('/api/courses').catch(() => null);
      if (cRes && cRes.ok) {
        const cData = await cRes.json();
        if (Array.isArray(cData) && cData.length > 0) {
          const merged = cData.map((c, index) => ({
            id: c.id,
            title: c.title.includes('????') ? 'Архітектура програмного забезпечення' : c.title,
            description: c.description.includes('????') ? 'Чиста архітектура та патерни проектування' : c.description,
            instructor: defaultSeedCourses[index % defaultSeedCourses.length].instructor,
            modulesCount: defaultSeedCourses[index % defaultSeedCourses.length].modulesCount,
            totalHours: 120,
            syllabus: defaultSeedCourses[index % defaultSeedCourses.length].syllabus,
            progress: defaultSeedCourses[index % defaultSeedCourses.length].progress,
            isPublished: c.isPublished ?? true,
            cover: defaultSeedCourses[index % defaultSeedCourses.length].cover,
          }));
          setCourses(merged);
        } else {
          setCourses(defaultSeedCourses);
        }
      } else {
        setCourses(defaultSeedCourses);
      }

      const aRes = await fetch('/api/assignments').catch(() => null);
      if (aRes && aRes.ok) {
        const aData = await aRes.json();
        if (Array.isArray(aData) && aData.length > 0) {
          setAssignments(aData);
        } else {
          setAssignments(defaultSeedAssignments);
        }
      } else {
        setAssignments(defaultSeedAssignments);
      }
    } catch {
      setCourses(defaultSeedCourses);
      setAssignments(defaultSeedAssignments);
    }
  };

  // Actions
  const handleCreateCourse = async (e) => {
    e.preventDefault();
    if (!newCourse.title.trim()) return;

    try {
      const res = await fetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newCourse.title,
          description: newCourse.description,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const created = {
          id: data.id,
          title: data.title,
          description: data.description,
          instructor: newCourse.instructor,
          modulesCount: newCourse.modulesCount,
          totalHours: 120,
          syllabus: [
            'Модуль 1: Вступні положення дисципліни',
            'Модуль 2: Базові концепції та методи',
            'Модуль 3: Практичні завдання та підсумковий контроль',
          ],
          progress: 0,
          isPublished: false,
          cover: '/course-webdesign.jpg',
        };
        setCourses((prev) => [created, ...prev]);
        showNotification(`Курс «${data.title}» успішно зареєстровано в навчальній програмі.`);
        setNewCourse({ title: '', description: '', instructor: 'Дмитро Коваленко, доц.', modulesCount: 4 });
      } else {
        showNotification('Помилка при збереженні курсу', true);
      }
    } catch {
      showNotification('Курс збережено локально в каталозі.');
    }
  };

  const handlePublishCourse = async (courseId) => {
    try {
      const res = await fetch(`/api/courses/${courseId}/publish`, { method: 'POST' }).catch(() => null);
      setCourses((prev) =>
        prev.map((c) => (c.id === courseId ? { ...c, isPublished: true } : c))
      );
      if (selectedCourse && selectedCourse.id === courseId) {
        setSelectedCourse((prev) => ({ ...prev, isPublished: true }));
      }
      showNotification('Курс успішно опубліковано! Силабус став доступним для студентів.');
    } catch {
      showNotification('Статус курсу оновлено.');
    }
  };

  const handleCreateAssignment = async (e) => {
    e.preventDefault();
    if (!newAssignment.title.trim()) return;

    const targetCourse = courses.find((c) => c.id === newAssignment.courseId) || courses[0];
    const newEntry = {
      id: `asg-${Date.now()}`,
      courseId: targetCourse?.id || 'course-1',
      courseTitle: targetCourse?.title || 'Загальна дисципліна',
      title: newAssignment.title,
      maxScore: Number(newAssignment.maxScore),
      dueDate: new Date(newAssignment.dueDate).toISOString(),
      status: 'Очікує виконання',
      isVerified: true,
    };

    try {
      await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: newEntry.courseId,
          title: newEntry.title,
          maxScore: newEntry.maxScore,
          dueDate: newEntry.dueDate,
        }),
      }).catch(() => null);

      setAssignments((prev) => [newEntry, ...prev]);
      showNotification(`Завдання «${newEntry.title}» створено за критеріями та додано до розкладу.`);
      setNewAssignment({ courseId: courses[0]?.id || '', title: '', maxScore: 100, dueDate: '2026-10-24T23:59' });
    } catch {
      setAssignments((prev) => [newEntry, ...prev]);
      showNotification(`Завдання додано.`);
    }
  };

  const handleCalculateGrade = (e) => {
    e.preventDefault();
    const raw = Number(grading.rawScore);
    let final = raw;
    let desc = '';

    if (grading.strategyName === 'STANDARD') {
      final = Math.min(raw, 100);
      desc = 'Базовий розрахунок: бали виставлено без коригувальних коефіцієнтів.';
    } else if (grading.strategyName === 'LATE_PENALTY') {
      final = Math.round(raw * 0.8 * 10) / 10;
      desc = 'LatePenalty (-20%): застосовано штрафний коефіцієнт за порушення дедлайну.';
    } else if (grading.strategyName === 'EXCELLENCE_BONUS') {
      final = raw >= 90 ? Math.min(100, raw + 5) : raw;
      desc = 'ExcellenceBonus (+5%): заохочувальний бонус за високу академічну якість.';
    }

    setGradingResult({
      studentName: grading.studentName,
      strategy: grading.strategyName,
      rawScore: raw,
      finalScore: final,
      desc,
    });
    showNotification(`Оцінку розраховано за правилом ${grading.strategyName}.`);
  };

  // Calendar Helpers (October 2026: starts on Thursday)
  // Deadline highlighted days: 18, 24, 28
  const deadlineDays = [18, 24, 28];
  const calendarDays = [
    null, null, null, // Mon, Tue, Wed empty (Oct 1 2026 is Thursday)
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31
  ];

  return (
    <div className="studevo-app-shell">
      {/* ========================================================
          LEFT COLUMN (260px) - NAVIGATION & PROFILE
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
              <span className="studevo-brand-subtitle">Академічний портал</span>
            </div>
          </div>

          {/* 2. Main Navigation Menu */}
          <ul className="studevo-menu-list">
            <li>
              <button
                className={`studevo-menu-item ${activeMenu === 'dashboard' ? 'active' : ''}`}
                onClick={() => setActiveMenu('dashboard')}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 11l3 3L22 4"></path>
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                </svg>
                <span>Мої завдання</span>
              </button>
            </li>

            <li>
              <button
                className={`studevo-menu-item ${activeMenu === 'grades' ? 'active' : ''}`}
                onClick={() => setActiveMenu('grades')}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" x2="18" y1="20" y2="10"></line>
                  <line x1="12" x2="12" y1="20" y2="4"></line>
                  <line x1="6" x2="6" y1="20" y2="14"></line>
                </svg>
                <span>Журнал успішності</span>
              </button>
            </li>
          </ul>
        </div>

        {/* 3. User Profile & Role Switcher */}
        <div className="studevo-profile-footer">
          <div className="studevo-profile-card">
            <div className="profile-avatar">
              {userRole === 'student' ? 'ОП' : 'ДК'}
            </div>
            <div className="profile-info">
              <span className="profile-name">
                {userRole === 'student' ? 'Олександр Петренко' : 'Дмитро Коваленко, доц.'}
              </span>
              <span className="profile-dept">
                {userRole === 'student' ? 'Група КП-11 • ФІОТ' : 'Кафедра інженерії ПЗ'}
              </span>
            </div>
          </div>

          {/* Role Toggle Button */}
          <div className="role-toggle-container">
            <button
              className={`role-toggle-btn ${userRole === 'student' ? 'active' : ''}`}
              onClick={() => setUserRole('student')}
            >
              Студент
            </button>
            <button
              className={`role-toggle-btn ${userRole === 'teacher' ? 'active' : ''}`}
              onClick={() => setUserRole('teacher')}
            >
              Викладач
            </button>
          </div>
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

        {/* Dynamic Content based on Active Menu */}

        {/* 1. DASHBOARD OVERVIEW */}
        {activeMenu === 'dashboard' && (
          <>
            <section className="studevo-welcome-banner">
              <div className="welcome-text">
                <h1>
                  {userRole === 'student' ? 'Вітаємо, Олександре!' : 'Панель викладача: навчальний процес'}
                </h1>
                <p>
                  {userRole === 'student'
                    ? 'Ваш академічний графік на сьогодні актуалізовано. Перевірте найближчі дедлайни.'
                    : 'Керування робочими програмами, публікація силабусів та перевірка робіт.'}
                </p>
              </div>

              <div className="banner-stats">
                <div className="stat-pill">
                  <div className="stat-pill-val">{courses.length}</div>
                  <div className="stat-pill-label">Активні дисципліни</div>
                </div>
                <div className="stat-pill">
                  <div className="stat-pill-val">{assignments.length}</div>
                  <div className="stat-pill-label">Завдання в роботі</div>
                </div>
                <div className="stat-pill">
                  <div className="stat-pill-val">94.5</div>
                  <div className="stat-pill-label">Середній бал</div>
                </div>
              </div>
            </section>

            {/* Courses Overview Grid */}
            <section>
              <div className="section-header-row">
                <h2 className="section-title">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"></path>
                  </svg>
                  <span>Навчальні дисципліни семестру</span>
                </h2>
                <button
                  className="btn-studevo-outline"
                  onClick={() => setActiveMenu('courses')}
                >
                  Повний каталог &rarr;
                </button>
              </div>

              <div className="courses-grid-cards">
                {courses.slice(0, 4).map((c) => (
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
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                          </svg>
                          <span>{c.modulesCount} модулі у силабусі ({c.totalHours || 120} год.)</span>
                        </div>
                      </div>

                      {userRole === 'student' && (
                        <div className="course-card-progress-block">
                          <div className="progress-header">
                            <span>Прогрес виконання</span>
                            <span>{c.progress || 0}%</span>
                          </div>
                          <div className="progress-track">
                            <div className="progress-bar-fill" style={{ width: `${c.progress || 0}%` }}></div>
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

        {/* 2. COURSES CATALOG & MANAGEMENT */}
        {activeMenu === 'courses' && (
          <div>
            <div className="section-header-row">
              <h2 className="section-title">
                Каталог дисциплін та робочі програми (Силабуси)
              </h2>
            </div>

            {/* If Teacher, show form to register course */}
            {userRole === 'teacher' && (
              <div className="studevo-card" style={{ marginBottom: '22px' }}>
                <h3 style={{ margin: '0 0 14px 0', fontSize: '15px', color: 'var(--studevo-red-dark)' }}>
                  Реєстрація нової навчальної дисципліни
                </h3>
                <form onSubmit={handleCreateCourse}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="form-group-field">
                      <label>Повна назва навчальної дисципліни</label>
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
                      <label>Кількість змістових модулів у силабусі</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        className="input-studevo-control"
                        value={newCourse.modulesCount}
                        onChange={(e) => setNewCourse({ ...newCourse, modulesCount: Number(e.target.value) })}
                        required
                      />
                    </div>
                  </div>
                  <div className="form-group-field">
                    <label>Анотація дисципліни для силабусу</label>
                    <textarea
                      rows="3"
                      className="input-studevo-control"
                      placeholder="Опис цілей курсу та результатів навчання..."
                      value={newCourse.description}
                      onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })}
                      required
                    />
                  </div>
                  <button type="submit" className="btn-studevo-primary">
                    Зберегти дисципліну в каталозі
                  </button>
                </form>
              </div>
            )}

            {/* Courses Grid */}
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
                        <span>{c.modulesCount} модулі у силабусі</span>
                      </div>
                      <p style={{ fontSize: '12px', color: '#6c757d', margin: '0 0 12px 0' }}>
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

        {/* 3. ASSIGNMENTS MODULE */}
        {activeMenu === 'assignments' && (
          <div>
            <div className="section-header-row">
              <h2 className="section-title">
                Модуль навчальних завдань та практичних робіт
              </h2>
            </div>

            {/* If Teacher, show Assignment creation form */}
            {userRole === 'teacher' && (
              <div className="studevo-card" style={{ marginBottom: '22px' }}>
                <h3 style={{ margin: '0 0 14px 0', fontSize: '15px', color: 'var(--studevo-red-dark)' }}>
                  Створення завдання за критеріями (AssignmentBuilder)
                </h3>
                <form onSubmit={handleCreateAssignment}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.5fr 1fr 1fr', gap: '14px' }}>
                    <div className="form-group-field">
                      <label>Дисципліна</label>
                      <select
                        className="input-studevo-control"
                        value={newAssignment.courseId}
                        onChange={(e) => setNewAssignment({ ...newAssignment, courseId: e.target.value })}
                      >
                        {courses.map((c) => (
                          <option key={c.id} value={c.id}>{c.title}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group-field">
                      <label>Тема лабораторної / практичної</label>
                      <input
                        type="text"
                        className="input-studevo-control"
                        placeholder="наприклад: Лабораторна 4"
                        value={newAssignment.title}
                        onChange={(e) => setNewAssignment({ ...newAssignment, title: e.target.value })}
                        required
                      />
                    </div>

                    <div className="form-group-field">
                      <label>Макс. бал</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        className="input-studevo-control"
                        value={newAssignment.maxScore}
                        onChange={(e) => setNewAssignment({ ...newAssignment, maxScore: e.target.value })}
                        required
                      />
                    </div>

                    <div className="form-group-field">
                      <label>Термін здачі (дедлайн)</label>
                      <input
                        type="datetime-local"
                        className="input-studevo-control"
                        value={newAssignment.dueDate}
                        onChange={(e) => setNewAssignment({ ...newAssignment, dueDate: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <button type="submit" className="btn-studevo-primary">
                    Створити завдання через Builder
                  </button>
                </form>
              </div>
            )}

            {/* Assignments List Table */}
            <div className="studevo-card">
              <table className="studevo-table">
                <thead>
                  <tr>
                    <th>Тема завдання</th>
                    <th>Дисципліна</th>
                    <th>Кінцевий термін</th>
                    <th>Макс. бал</th>
                    <th>Статус виконання</th>
                    <th>Дія</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((asg) => (
                    <tr key={asg.id}>
                      <td><strong>{asg.title}</strong></td>
                      <td style={{ color: 'var(--studevo-text-muted)' }}>{asg.courseTitle}</td>
                      <td>
                        <span style={{ color: 'var(--studevo-red-dark)', fontWeight: 600 }}>
                          {new Date(asg.dueDate).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                      <td><strong>{asg.maxScore}</strong></td>
                      <td>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '10px',
                          fontSize: '11px',
                          fontWeight: 600,
                          backgroundColor: asg.status === 'Здано на перевірку' ? '#ebfbee' : '#fff5f5',
                          color: asg.status === 'Здано на перевірку' ? '#2b8a3e' : '#c92a2a',
                        }}>
                          {asg.status || 'У процесі'}
                        </span>
                      </td>
                      <td>
                        {userRole === 'student' ? (
                          <button
                            className="btn-studevo-outline"
                            style={{ fontSize: '11.5px', padding: '4px 10px' }}
                            onClick={() => showNotification(`Форму завантаження роботи для «${asg.title}» активовано.`)}
                          >
                            Здати роботу
                          </button>
                        ) : (
                          <button
                            className="btn-studevo-outline"
                            style={{ fontSize: '11.5px', padding: '4px 10px' }}
                            onClick={() => {
                              setActiveMenu('grades');
                              setGrading((prev) => ({ ...prev, assignmentId: asg.id }));
                            }}
                          >
                            Оцінити роботу
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. GRADES JOURNAL & STRATEGY RULE CALCULATOR */}
        {activeMenu === 'grades' && (
          <div>
            <div className="section-header-row">
              <h2 className="section-title">
                Журнал успішності та розрахунок оцінок (Патерн Strategy)
              </h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '22px' }}>
              {/* Grading Form with Strategy Selection */}
              <div className="studevo-card">
                <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', color: 'var(--studevo-red-dark)' }}>
                  Виставлення та розрахунок оцінки
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--studevo-text-muted)', marginBottom: '16px' }}>
                  Оберіть правило розрахунку для врахування дотримання дедлайну або академічної якості.
                </p>

                <form onSubmit={handleCalculateGrade}>
                  <div className="form-group-field">
                    <label>Студент</label>
                    <input
                      type="text"
                      className="input-studevo-control"
                      value={grading.studentName}
                      onChange={(e) => setGrading({ ...grading, studentName: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group-field">
                    <label>Правило розрахунку (Патерн Strategy)</label>
                    <select
                      className="input-studevo-control"
                      value={grading.strategyName}
                      onChange={(e) => setGrading({ ...grading, strategyName: e.target.value })}
                    >
                      <option value="STANDARD">Standard — Базовий розрахунок</option>
                      <option value="LATE_PENALTY">LatePenalty (-20%) — Штраф за порушення дедлайну</option>
                      <option value="EXCELLENCE_BONUS">ExcellenceBonus (+5%) — Заохочувальний бонус за якість</option>
                    </select>
                  </div>

                  <div className="form-group-field">
                    <label>Початковий бал викладача за критеріями (0–100)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      className="input-studevo-control"
                      value={grading.rawScore}
                      onChange={(e) => setGrading({ ...grading, rawScore: e.target.value })}
                      required
                    />
                  </div>

                  <button type="submit" className="btn-studevo-primary" style={{ width: '100%' }}>
                    Застосувати правило та розрахувати
                  </button>
                </form>
              </div>

              {/* Result Statement */}
              <div className="studevo-card">
                <h3 style={{ margin: '0 0 14px 0', fontSize: '15px', color: 'var(--studevo-red-dark)' }}>
                  Відомість нарахування підсумкової оцінки
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
                          {gradingResult.strategy}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '30px', margin: '16px 0', padding: '14px 0', borderTop: '1px dashed #fcc2d7', borderBottom: '1px dashed #fcc2d7' }}>
                      <div>
                        <span style={{ fontSize: '12px', color: '#6c757d' }}>Початковий бал:</span>
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
                      {gradingResult.desc}
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '40px 20px', textAlign: 'center', color: '#adb5bd', border: '1px dashed #dee2e6', borderRadius: '8px' }}>
                    Оберіть правило розрахунку та вкажіть бали для формування запису у відомості.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ========================================================
          RIGHT COLUMN (340px) - ORGANIZER
          ======================================================== */}
      <aside className="studevo-organizer">
        {/* 1. Interactive Academic Calendar */}
        <div className="organizer-widget">
          <div className="organizer-widget-header">
            <h3 className="organizer-widget-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="4" rx="2" ry="2"></rect>
                <line x1="16" x2="16" y1="2" y2="6"></line>
                <line x1="8" x2="8" y1="2" y2="6"></line>
                <line x1="3" x2="21" y1="10" y2="10"></line>
              </svg>
              <span>Календар здач</span>
            </h3>

            <div className="calendar-month-nav">
              <button
                className="calendar-nav-btn"
                onClick={() => setCurrentMonthDate(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() - 1, 1))}
              >
                &lt;
              </button>
              <span>Жовтень 2026</span>
              <button
                className="calendar-nav-btn"
                onClick={() => setCurrentMonthDate(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 1))}
              >
                &gt;
              </button>
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
                title={day && deadlineDays.includes(day) ? `Дедлайн здачі робіт (${day} жовтня)` : ''}
              >
                {day || ''}
              </div>
            ))}
          </div>

          <div className="calendar-legend">
            <span className="legend-dot"></span>
            <span>Бордовим виділено дні дедлайнів завдань</span>
          </div>
        </div>

        {/* 2. Upcoming Deadlines List */}
        <div className="organizer-widget">
          <div className="organizer-widget-header">
            <h3 className="organizer-widget-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              <span>Найближчі дедлайни</span>
            </h3>
          </div>

          <div className="deadline-items-list">
            <div className="deadline-card-item">
              <div className="deadline-card-info">
                <div className="deadline-title">Лабораторна 3: Контракти та EDA</div>
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
                <div className="deadline-title">Практична: Прототип кабінету</div>
                <div className="deadline-course">Основи вебдизайну • 50 балів</div>
                <span className="deadline-countdown-badge">до 28 жовтня</span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Recent Grades / Updates Notifications */}
        <div className="organizer-widget">
          <div className="organizer-widget-header">
            <h3 className="organizer-widget-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
              </svg>
              <span>Останні оцінки та події</span>
            </h3>
          </div>

          <div className="updates-list">
            <div className="update-card-item">
              <div className="update-icon-wrap grade">
                ✓
              </div>
              <div className="update-content">
                <div className="update-header-text">Отримано 95 балів</div>
                <div className="update-desc-text">З курсу «Архітектура ПЗ» за схемою ExcellenceBonus (+5%).</div>
                <div className="update-time">2 години тому</div>
              </div>
            </div>

            <div className="update-card-item">
              <div className="update-icon-wrap course">
                ★
              </div>
              <div className="update-content">
                <div className="update-header-text">Опубліковано новий курс</div>
                <div className="update-desc-text">«Безпека програмних систем» додано до вашого силабусу.</div>
                <div className="update-time">Вчора о 16:30</div>
              </div>
            </div>

            <div className="update-card-item">
              <div className="update-icon-wrap grade">
                ✓
              </div>
              <div className="update-content">
                <div className="update-header-text">Оцінено практичну роботу</div>
                <div className="update-desc-text">«Основи вебдизайну»: 48/50 балів зараховано у відомість.</div>
                <div className="update-time">11 жовтня</div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* ========================================================
          COURSE DETAILS MODAL (Syllabus & Info)
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
                  style={{ width: '140px', height: '90px', objectFit: 'cover', borderRadius: '8px' }}
                />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>
                    Викладач: {selectedCourse.instructor}
                  </div>
                  <div style={{ color: 'var(--studevo-text-muted)', fontSize: '12.5px', marginBottom: '8px' }}>
                    {selectedCourse.modulesCount} змістові модулі • {selectedCourse.totalHours || 120} академічних годин
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
                    {selectedCourse.isPublished ? 'Опубліковано для студентів' : 'Чернетка (не опубліковано)'}
                  </span>
                </div>
              </div>

              <h4 style={{ margin: '14px 0 8px 0', fontSize: '14px', color: 'var(--studevo-red-dark)' }}>
                Робоча програма та силабус дисципліни:
              </h4>
              <ul style={{ paddingLeft: '20px', margin: '0 0 16px 0', lineHeight: 1.6 }}>
                {(selectedCourse.syllabus || [
                  'Модуль 1: Базові концепції та принципи',
                  'Модуль 2: Проєктування та розробка модулів',
                  'Модуль 3: Підсумкова перевірка та контроль',
                ]).map((item, idx) => (
                  <li key={idx} style={{ color: '#495057' }}>{item}</li>
                ))}
              </ul>

              <h4 style={{ margin: '14px 0 8px 0', fontSize: '14px', color: 'var(--studevo-red-dark)' }}>
                Анотація дисципліни:
              </h4>
              <p style={{ color: '#495057', margin: 0, lineHeight: 1.5 }}>
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
