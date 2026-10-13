import { useState, useEffect } from 'react';
import './App.css';

export default function App() {
  const [activeNav, setActiveNav] = useState('home'); // 'home', 'courses', 'cabinet', 'calendar', 'help'
  const [subTab, setSubTab] = useState('courses'); // for lab features: 'courses', 'assignments', 'grading', 'architecture'
  const [health, setHealth] = useState({ gateway: 'UP', courseService: 'UNKNOWN', assignmentService: 'UNKNOWN' });
  const [courses, setCourses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [students, setStudents] = useState([]);
  const [notification, setNotification] = useState(null);
  const [loading, setLoading] = useState(false);

  // Form states
  const [newCourse, setNewCourse] = useState({ title: '', description: '' });
  const [newStudent, setNewStudent] = useState({ name: '', email: '' });
  const [newAssignment, setNewAssignment] = useState({
    courseId: '',
    title: '',
    maxScore: 100,
    dueDate: '2026-12-31T23:59',
  });
  const [grading, setGrading] = useState({
    rawScore: 90,
    strategyName: 'STANDARD',
  });
  const [gradingResult, setGradingResult] = useState(null);

  useEffect(() => {
    fetchHealth();
    loadAllData();
  }, []);

  const showNotification = (text, isError = false) => {
    setNotification({ text, isError });
    setTimeout(() => setNotification(null), 6000);
  };

  const fetchHealth = async () => {
    try {
      const res = await fetch('/health');
      if (res.ok) {
        const data = await res.json();
        setHealth({
          gateway: data.status || 'UP',
          courseService: data.downstreamServices?.courseService?.status || 'DOWN',
          assignmentService: data.downstreamServices?.assignmentService?.status || 'DOWN',
        });
      } else {
        setHealth({ gateway: 'UP', courseService: 'DOWN', assignmentService: 'DOWN' });
      }
    } catch {
      setHealth({ gateway: 'DOWN', courseService: 'DOWN', assignmentService: 'DOWN' });
    }
  };

  const loadAllData = async () => {
    setLoading(true);
    try {
      const cRes = await fetch('/api/courses').catch(() => null);
      if (cRes && cRes.ok) {
        const cData = await cRes.json();
        // Clean out any corrupted titles if needed
        const formattedCourses = cData.map((c) => ({
          ...c,
          title: c.title.includes('????') ? 'Архітектура ПЗ та DDD' : c.title,
          description: c.description.includes('????') ? 'Базовий курс з чистої архітектури та мікросервісів' : c.description,
        }));
        setCourses(formattedCourses);
        if (formattedCourses.length > 0 && !newAssignment.courseId) {
          setNewAssignment((prev) => ({ ...prev, courseId: formattedCourses[0].id }));
        }
      }

      const aRes = await fetch('/api/assignments').catch(() => null);
      if (aRes && aRes.ok) {
        const aData = await aRes.json();
        setAssignments(aData);
      }
    } catch (err) {
      console.warn('Помилка завантаження даних:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    if (!newCourse.title.trim()) return;

    try {
      const res = await fetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCourse),
      });

      if (res.ok) {
        const data = await res.json();
        showNotification(`Курс "${data.title}" успішно зареєстровано в системі Studevo.`);
        setNewCourse({ title: '', description: '' });
        loadAllData();
      } else {
        const err = await res.json();
        showNotification(`Помилка: ${err.message}`, true);
      }
    } catch (err) {
      showNotification(`Помилка з'єднання: ${err.message}`, true);
    }
  };

  const handlePublishCourse = async (courseId) => {
    try {
      const res = await fetch(`/api/courses/${courseId}/publish`, { method: 'POST' });
      if (res.ok) {
        showNotification(`Курс опубліковано. Подію course.published передано брокеру Redis.`);
        loadAllData();
      } else {
        const err = await res.json();
        showNotification(`Помилка публікації: ${err.message}`, true);
      }
    } catch (err) {
      showNotification(`Помилка мережі: ${err.message}`, true);
    }
  };

  const handleRegisterStudent = async (e) => {
    e.preventDefault();
    if (!newStudent.name.trim() || !newStudent.email.trim()) return;

    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newStudent),
      });

      if (res.ok) {
        const data = await res.json();
        showNotification(`Студента "${data.name}" зареєстровано в системі.`);
        setStudents((prev) => [...prev, data]);
        setNewStudent({ name: '', email: '' });
      } else {
        const err = await res.json();
        showNotification(`Помилка: ${err.message}`, true);
      }
    } catch (err) {
      showNotification(`Помилка реєстрації: ${err.message}`, true);
    }
  };

  const handleCreateAssignment = async (e) => {
    e.preventDefault();
    if (!newAssignment.title.trim()) return;

    try {
      const payload = {
        courseId: newAssignment.courseId || (courses[0]?.id ?? '00000000-0000-0000-0000-000000000000'),
        title: newAssignment.title,
        maxScore: Number(newAssignment.maxScore),
        dueDate: new Date(newAssignment.dueDate).toISOString(),
      };

      const res = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        const notice = data.fallbackNotice
          ? `Завдання створено в автономному режимі (Fallback: ${data.fallbackNotice})`
          : `Завдання створено через AssignmentBuilder та верифіковано Course Service.`;
        showNotification(notice, Boolean(data.fallbackNotice));
        setNewAssignment((prev) => ({ ...prev, title: '' }));
        loadAllData();
      } else {
        const err = await res.json();
        showNotification(`Помилка: ${err.message}`, true);
      }
    } catch (err) {
      showNotification(`Помилка мережі: ${err.message}`, true);
    }
  };

  const handleCalculateGrade = (e) => {
    e.preventDefault();
    const raw = Number(grading.rawScore);
    let final = raw;
    let description = '';

    if (grading.strategyName === 'STANDARD') {
      final = Math.min(raw, 100);
      description = 'Стандартна схема: бали нараховано без модифікацій.';
    } else if (grading.strategyName === 'LATE_PENALTY') {
      final = Math.round(raw * 0.8 * 100) / 100;
      description = 'Схема LatePenalty: застосовано штрафний коефіцієнт 0.8 (-20%) за порушення терміну.';
    } else if (grading.strategyName === 'EXCELLENCE_BONUS') {
      final = raw >= 90 ? Math.min(100, raw + 5) : raw;
      description = 'Схема ExcellenceBonus: нараховано заохочувальний бонус +5 балів за високу якість вчасно.';
    }

    setGradingResult({
      strategy: grading.strategyName,
      rawScore: raw,
      finalScore: final,
      description,
    });
  };

  return (
    <div>
      {/* TOP NAVBAR */}
      <header className="studevo-header">
        <div className="studevo-header-left">
          {/* Studevo Brand Logo */}
          <div className="studevo-logo" onClick={() => setActiveNav('home')}>
            <div className="studevo-logo-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"></path>
                <path d="M6 6h10"></path>
                <path d="M6 10h10"></path>
              </svg>
            </div>
            <div className="studevo-logo-text">
              Stud<span>evo</span>
            </div>
          </div>

          {/* Top Navigation Links */}
          <ul className="studevo-nav-links">
            <li>
              <span
                className={`studevo-nav-link ${activeNav === 'home' ? 'active' : ''}`}
                onClick={() => setActiveNav('home')}
              >
                Головна
              </span>
            </li>
            <li>
              <span
                className={`studevo-nav-link ${activeNav === 'courses' ? 'active' : ''}`}
                onClick={() => { setActiveNav('courses'); setSubTab('courses'); }}
              >
                Курси
              </span>
            </li>
            <li>
              <span
                className={`studevo-nav-link ${activeNav === 'cabinet' ? 'active' : ''}`}
                onClick={() => { setActiveNav('cabinet'); setSubTab('assignments'); }}
              >
                Мій кабінет
              </span>
            </li>
            <li>
              <span
                className={`studevo-nav-link ${activeNav === 'calendar' ? 'active' : ''}`}
                onClick={() => setActiveNav('calendar')}
              >
                Календар
              </span>
            </li>
            <li>
              <span
                className={`studevo-nav-link ${activeNav === 'help' ? 'active' : ''}`}
                onClick={() => { setActiveNav('help'); setSubTab('architecture'); }}
              >
                Довідка
              </span>
            </li>
          </ul>
        </div>

        {/* Top Navbar Right: Search, Notifications, Health, Profile */}
        <div className="studevo-header-right">
          {/* Microservices Health Monitor */}
          <div className="header-status-pills">
            <span>Шлюз:</span>
            <span className={`header-status-pill ${health.gateway === 'UP' ? 'up' : 'down'}`}>
              {health.gateway === 'UP' ? 'В нормі' : 'Збій'}
            </span>
            <span>Курси:</span>
            <span className={`header-status-pill ${health.courseService === 'UP' ? 'up' : 'down'}`}>
              {health.courseService === 'UP' ? 'В нормі' : 'Збій'}
            </span>
            <span>Завдання:</span>
            <span className={`header-status-pill ${health.assignmentService === 'UP' ? 'up' : 'down'}`}>
              {health.assignmentService === 'UP' ? 'В нормі' : 'Збій'}
            </span>
          </div>

          {/* Search Button */}
          <button className="nav-icon-btn" title="Пошук">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </button>

          {/* Notification Bell */}
          <button className="nav-icon-btn" title="Сповіщення">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
            <span className="notification-badge-dot"></span>
          </button>

          {/* User Profile */}
          <button className="user-profile-btn">
            <div className="user-avatar-circle">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </div>
            <span className="user-profile-name">Увійти / Кабінет</span>
          </button>
        </div>
      </header>

      {/* FULL-WIDTH DASHBOARD LAYOUT */}
      <div className="studevo-main-container">
        {/* LEFT SIDEBAR */}
        <aside className="studevo-sidebar-left">
          <button
            className={`sidebar-nav-item ${activeNav === 'home' ? 'active' : ''}`}
            onClick={() => setActiveNav('home')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
            <span>Головна</span>
          </button>

          <button
            className={`sidebar-nav-item ${activeNav === 'courses' ? 'active' : ''}`}
            onClick={() => { setActiveNav('courses'); setSubTab('courses'); }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"></path>
            </svg>
            <span>Курси</span>
          </button>

          <button
            className={`sidebar-nav-item ${activeNav === 'cabinet' ? 'active' : ''}`}
            onClick={() => { setActiveNav('cabinet'); setSubTab('assignments'); }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            <span>Мій кабінет</span>
          </button>

          <button
            className={`sidebar-nav-item ${activeNav === 'calendar' ? 'active' : ''}`}
            onClick={() => setActiveNav('calendar')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="4" rx="2" ry="2"></rect>
              <line x1="16" x2="16" y1="2" y2="6"></line>
              <line x1="8" x2="8" y1="2" y2="6"></line>
              <line x1="3" x2="21" y1="10" y2="10"></line>
            </svg>
            <span>Календар</span>
          </button>

          <button
            className={`sidebar-nav-item ${activeNav === 'help' ? 'active' : ''}`}
            onClick={() => { setActiveNav('help'); setSubTab('architecture'); }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
              <line x1="12" x2="12.01" y1="17" y2="17"></line>
            </svg>
            <span>Довідка</span>
          </button>
        </aside>

        {/* CENTER CONTENT */}
        <main className="studevo-content-center">
          {/* Notifications */}
          {notification && (
            <div className={`studevo-alert ${notification.isError ? 'studevo-alert-danger' : 'studevo-alert-success'}`}>
              {notification.text}
            </div>
          )}

          {/* HERO BANNER (Matches Photo 2) */}
          <section className="studevo-hero-banner">
            <div className="hero-text-block">
              <h1>Твоя платформа для сучасного навчання</h1>
              <p>Дистанційна освіта нового покоління. Вчися впевнено та ефективно!</p>
              <div className="hero-actions">
                <button
                  className="hero-btn-white"
                  onClick={() => { setActiveNav('courses'); setSubTab('courses'); }}
                >
                  Мої курси
                </button>
                <button
                  className="hero-btn-outline"
                  onClick={() => { setActiveNav('courses'); setSubTab('courses'); }}
                >
                  Каталог курсів
                </button>
              </div>
            </div>
            <div className="hero-image-block">
              <img src="/hero-students.jpg" alt="Студенти Studevo" />
            </div>
          </section>

          {/* VIEW: HOME (Photo 2 Main Screen) */}
          {activeNav === 'home' && (
            <div>
              {/* 4 Featured Courses Grid */}
              <div className="studevo-courses-grid">
                {/* Course 1 */}
                <div className="studevo-course-card">
                  <div className="course-card-image-wrap">
                    <img src="/course-webdesign.jpg" alt="Основи вебдизайну" />
                  </div>
                  <div className="course-card-body">
                    <h3 className="course-card-title">Основи вебдизайну</h3>
                    <div className="course-progress-wrap">
                      <div className="course-progress-bar">
                        <div className="course-progress-fill" style={{ width: '45%' }}></div>
                      </div>
                      <div className="course-progress-label">Завершено на 45%</div>
                    </div>
                  </div>
                </div>

                {/* Course 2 */}
                <div className="studevo-course-card">
                  <div className="course-card-image-wrap">
                    <img src="/course-literature.jpg" alt="Українська мова та література" />
                  </div>
                  <div className="course-card-body">
                    <h3 className="course-card-title">Українська мова та література</h3>
                    <div className="course-progress-wrap">
                      <div className="course-progress-bar">
                        <div className="course-progress-fill" style={{ width: '40%' }}></div>
                      </div>
                      <div className="course-progress-label">Завершено на 40%</div>
                    </div>
                  </div>
                </div>

                {/* Course 3 */}
                <div className="studevo-course-card">
                  <div className="course-card-image-wrap">
                    <img src="/course-math.jpg" alt="Математика для всіх" />
                  </div>
                  <div className="course-card-body">
                    <h3 className="course-card-title">Математика для всіх</h3>
                    <div className="course-progress-wrap">
                      <div className="course-progress-bar">
                        <div className="course-progress-fill" style={{ width: '45%' }}></div>
                      </div>
                      <div className="course-progress-label">Завершено на 45%</div>
                    </div>
                  </div>
                </div>

                {/* Course 4 */}
                <div className="studevo-course-card">
                  <div className="course-card-image-wrap">
                    <img src="/course-coding.jpg" alt="Вступ до програмування" />
                  </div>
                  <div className="course-card-body">
                    <h3 className="course-card-title">Вступ до програмування</h3>
                    <div className="course-progress-wrap">
                      <div className="course-progress-bar">
                        <div className="course-progress-fill" style={{ width: '45%' }}></div>
                      </div>
                      <div className="course-progress-label">Завершено на 45%</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Academic Management Panel */}
              <div className="studevo-card" style={{ marginTop: '20px' }}>
                <div className="studevo-card-header">
                  <span>Швидкий доступ до навчального процесу (Course & Assignment Services)</span>
                  <button
                    className="btn-studevo-outline"
                    onClick={() => { setActiveNav('courses'); setSubTab('courses'); }}
                  >
                    Перейти до керування курсами &rarr;
                  </button>
                </div>
                <div className="studevo-card-body">
                  <table className="studevo-table">
                    <thead>
                      <tr>
                        <th>Назва курсу</th>
                        <th>Опис / Анотація</th>
                        <th>Статус</th>
                        <th>Дія</th>
                      </tr>
                    </thead>
                    <tbody>
                      {courses.length === 0 ? (
                        <tr>
                          <td colSpan="4" style={{ textAlign: 'center', color: '#9ca3af', padding: '20px' }}>
                            {loading ? 'Завантаження курсів...' : 'Курсів ще немає в базі даних.'}
                          </td>
                        </tr>
                      ) : (
                        courses.map((c) => (
                          <tr key={c.id}>
                            <td><strong>{c.title}</strong></td>
                            <td style={{ color: '#6b7280' }}>{c.description}</td>
                            <td>
                              <span className={`studevo-tag ${c.isPublished ? 'tag-red-published' : 'tag-draft'}`}>
                                {c.isPublished ? 'Опубліковано' : 'Чернетка'}
                              </span>
                            </td>
                            <td>
                              {!c.isPublished ? (
                                <button className="btn-studevo-outline" onClick={() => handlePublishCourse(c.id)}>
                                  Опублікувати
                                </button>
                              ) : (
                                <span style={{ fontSize: '12px', color: '#059669', fontWeight: 600 }}>Доступний для вивчення</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: COURSES (Catalog & Management) */}
          {(activeNav === 'courses' || activeNav === 'cabinet' || activeNav === 'help') && (
            <div className="studevo-card">
              <div className="studevo-card-header">
                <span>Панель керування та лабораторних модулів Studevo</span>
                <div className="studevo-subtabs" style={{ margin: 0, padding: 0, border: 'none' }}>
                  <button
                    className={`subtab-pill ${subTab === 'courses' ? 'active' : ''}`}
                    onClick={() => setSubTab('courses')}
                  >
                    Каталог курсів
                  </button>
                  <button
                    className={`subtab-pill ${subTab === 'assignments' ? 'active' : ''}`}
                    onClick={() => setSubTab('assignments')}
                  >
                    Завдання та студенти
                  </button>
                  <button
                    className={`subtab-pill ${subTab === 'grading' ? 'active' : ''}`}
                    onClick={() => setSubTab('grading')}
                  >
                    Оцінювання (Strategy)
                  </button>
                  <button
                    className={`subtab-pill ${subTab === 'architecture' ? 'active' : ''}`}
                    onClick={() => setSubTab('architecture')}
                  >
                    Топологія (ЛР3/4)
                  </button>
                </div>
              </div>

              <div className="studevo-card-body">
                {/* SubTab 1: Courses */}
                {subTab === 'courses' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '24px' }}>
                    <div>
                      <h4 style={{ margin: '0 0 14px 0', fontSize: '15px' }}>Створення нового курсу</h4>
                      <form onSubmit={handleCreateCourse}>
                        <div className="form-group-custom">
                          <label>Повна назва навчальної дисципліни</label>
                          <input
                            type="text"
                            className="input-studevo"
                            placeholder="наприклад: Архітектура програмного забезпечення"
                            value={newCourse.title}
                            onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })}
                            required
                          />
                        </div>
                        <div className="form-group-custom">
                          <label>Анотація та робоча програма</label>
                          <textarea
                            rows="4"
                            className="input-studevo"
                            placeholder="Опис дисципліни..."
                            value={newCourse.description}
                            onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })}
                            required
                          />
                        </div>
                        <button type="submit" className="btn-studevo-red" style={{ width: '100%' }}>
                          Зберегти курс у Course Service
                        </button>
                      </form>
                    </div>

                    <div>
                      <h4 style={{ margin: '0 0 14px 0', fontSize: '15px' }}>Реєстр навчальних курсів ({courses.length})</h4>
                      <table className="studevo-table">
                        <thead>
                          <tr>
                            <th>Назва</th>
                            <th>Анотація</th>
                            <th>Статус</th>
                            <th>Дії</th>
                          </tr>
                        </thead>
                        <tbody>
                          {courses.map((course) => (
                            <tr key={course.id}>
                              <td><strong>{course.title}</strong></td>
                              <td style={{ color: '#6b7280' }}>{course.description}</td>
                              <td>
                                <span className={`studevo-tag ${course.isPublished ? 'tag-red-published' : 'tag-draft'}`}>
                                  {course.isPublished ? 'Опубліковано' : 'Чернетка'}
                                </span>
                              </td>
                              <td>
                                {!course.isPublished ? (
                                  <button className="btn-studevo-outline" onClick={() => handlePublishCourse(course.id)}>
                                    Опублікувати
                                  </button>
                                ) : (
                                  <span style={{ fontSize: '12px', color: '#059669', fontWeight: 600 }}>Активний</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* SubTab 2: Assignments */}
                {subTab === 'assignments' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '24px' }}>
                    <div>
                      <h4 style={{ margin: '0 0 14px 0', fontSize: '15px' }}>Створення завдання (Патерн Builder)</h4>
                      <form onSubmit={handleCreateAssignment}>
                        <div className="form-group-custom">
                          <label>Курс</label>
                          <select
                            className="input-studevo"
                            value={newAssignment.courseId}
                            onChange={(e) => setNewAssignment({ ...newAssignment, courseId: e.target.value })}
                          >
                            {courses.map((c) => (
                              <option key={c.id} value={c.id}>{c.title}</option>
                            ))}
                            {courses.length === 0 && <option value="">Немає курсів</option>}
                          </select>
                        </div>
                        <div className="form-group-custom">
                          <label>Тема завдання</label>
                          <input
                            type="text"
                            className="input-studevo"
                            placeholder="Лабораторна робота..."
                            value={newAssignment.title}
                            onChange={(e) => setNewAssignment({ ...newAssignment, title: e.target.value })}
                            required
                          />
                        </div>
                        <div className="form-group-custom">
                          <label>Макс. бал</label>
                          <input
                            type="number"
                            min="1"
                            max="100"
                            className="input-studevo"
                            value={newAssignment.maxScore}
                            onChange={(e) => setNewAssignment({ ...newAssignment, maxScore: e.target.value })}
                            required
                          />
                        </div>
                        <div className="form-group-custom">
                          <label>Дедлайн</label>
                          <input
                            type="datetime-local"
                            className="input-studevo"
                            value={newAssignment.dueDate}
                            onChange={(e) => setNewAssignment({ ...newAssignment, dueDate: e.target.value })}
                            required
                          />
                        </div>
                        <button type="submit" className="btn-studevo-red" style={{ width: '100%', marginBottom: '18px' }}>
                          Створити через Builder
                        </button>
                      </form>

                      <h4 style={{ margin: '14px 0 10px 0', fontSize: '15px' }}>Зарахування студента</h4>
                      <form onSubmit={handleRegisterStudent}>
                        <div className="form-group-custom">
                          <label>ПІБ студента</label>
                          <input
                            type="text"
                            className="input-studevo"
                            placeholder="Олександр Петренко"
                            value={newStudent.name}
                            onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                            required
                          />
                        </div>
                        <div className="form-group-custom">
                          <label>Email</label>
                          <input
                            type="email"
                            className="input-studevo"
                            placeholder="o.petrenko@univ.edu.ua"
                            value={newStudent.email}
                            onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                            required
                          />
                        </div>
                        <button type="submit" className="btn-studevo-outline" style={{ width: '100%' }}>
                          Зареєструвати студента
                        </button>
                      </form>
                    </div>

                    <div>
                      <h4 style={{ margin: '0 0 14px 0', fontSize: '15px' }}>Журнал виданих завдань ({assignments.length})</h4>
                      <table className="studevo-table">
                        <thead>
                          <tr>
                            <th>Тема</th>
                            <th>Курс</th>
                            <th>Макс. бал</th>
                            <th>Дедлайн</th>
                            <th>Статус верифікації</th>
                          </tr>
                        </thead>
                        <tbody>
                          {assignments.length === 0 ? (
                            <tr>
                              <td colSpan="5" style={{ textAlign: 'center', color: '#9ca3af', padding: '20px' }}>
                                Завдань ще немає.
                              </td>
                            </tr>
                          ) : (
                            assignments.map((item) => (
                              <tr key={item.id}>
                                <td><strong>{item.title}</strong></td>
                                <td>{item.courseTitle || 'Не визначено'}</td>
                                <td>{item.maxScore}</td>
                                <td>{new Date(item.dueDate).toLocaleDateString()}</td>
                                <td>
                                  <span className={`studevo-tag ${item.isCourseVerified ? 'tag-green-verified' : 'tag-orange-fallback'}`}>
                                    {item.isCourseVerified ? 'Верифіковано в Course Service' : 'Автономний режим (Fallback)'}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* SubTab 3: Grading */}
                {subTab === 'grading' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '24px' }}>
                    <div>
                      <h4 style={{ margin: '0 0 14px 0', fontSize: '15px' }}>Патерн Strategy для розрахунку балу</h4>
                      <form onSubmit={handleCalculateGrade}>
                        <div className="form-group-custom">
                          <label>Алгоритм (Strategy)</label>
                          <select
                            className="input-studevo"
                            value={grading.strategyName}
                            onChange={(e) => setGrading({ ...grading, strategyName: e.target.value })}
                          >
                            <option value="STANDARD">1. StandardGradingStrategy (Базовий)</option>
                            <option value="LATE_PENALTY">2. LatePenaltyGradingStrategy (-20%)</option>
                            <option value="EXCELLENCE_BONUS">3. ExcellenceBonusGradingStrategy (+5%)</option>
                          </select>
                        </div>
                        <div className="form-group-custom">
                          <label>Початковий бал викладача (0-100)</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            className="input-studevo"
                            value={grading.rawScore}
                            onChange={(e) => setGrading({ ...grading, rawScore: e.target.value })}
                            required
                          />
                        </div>
                        <button type="submit" className="btn-studevo-red" style={{ width: '100%' }}>
                          Розрахувати за патерном Strategy
                        </button>
                      </form>
                    </div>

                    <div>
                      <h4 style={{ margin: '0 0 14px 0', fontSize: '15px' }}>Результат розрахунку оцінки</h4>
                      {gradingResult ? (
                        <div style={{ background: '#fdf2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '24px' }}>
                          <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>Застосована стратегія:</div>
                          <div style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937', marginBottom: '18px' }}>
                            {gradingResult.strategy}
                          </div>
                          <div style={{ display: 'flex', gap: '40px', marginBottom: '16px' }}>
                            <div>
                              <div style={{ fontSize: '12px', color: '#6b7280' }}>Початковий бал:</div>
                              <div style={{ fontSize: '26px', fontWeight: 700 }}>{gradingResult.rawScore}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: '12px', color: '#6b7280' }}>Підсумковий бал:</div>
                              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--studevo-red)' }}>
                                {gradingResult.finalScore} / 100
                              </div>
                            </div>
                          </div>
                          <div style={{ fontSize: '13px', color: '#991b1b', background: '#fee2e2', padding: '10px 14px', borderRadius: '8px' }}>
                            {gradingResult.description}
                          </div>
                        </div>
                      ) : (
                        <div style={{ padding: '30px', textAlign: 'center', color: '#9ca3af', border: '1px dashed #e5e7eb', borderRadius: '12px' }}>
                          Вкажіть початковий бал та натисніть «Розрахувати».
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* SubTab 4: Architecture */}
                {subTab === 'architecture' && (
                  <div>
                    <h4 style={{ margin: '0 0 14px 0', fontSize: '15px' }}>Системна топологія мікросервісів Studevo</h4>
                    <table className="studevo-table" style={{ marginBottom: '20px' }}>
                      <thead>
                        <tr>
                          <th>Вузол архітектури</th>
                          <th>Мережевий порт</th>
                          <th>Зона відповідальності</th>
                          <th>База даних</th>
                          <th>Статус</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td><strong>API Gateway</strong></td>
                          <td><code>3000</code></td>
                          <td>Reverse Proxy, Swagger, маршрутизація</td>
                          <td>Stateless</td>
                          <td>
                            <span className={`studevo-tag ${health.gateway === 'UP' ? 'tag-green-verified' : 'tag-orange-fallback'}`}>
                              {health.gateway === 'UP' ? 'В нормі' : 'Недоступний'}
                            </span>
                          </td>
                        </tr>
                        <tr>
                          <td><strong>Course Service</strong></td>
                          <td><code>3001</code></td>
                          <td>Курси, навчальний силабус, публікація</td>
                          <td>PostgreSQL (5433)</td>
                          <td>
                            <span className={`studevo-tag ${health.courseService === 'UP' ? 'tag-green-verified' : 'tag-orange-fallback'}`}>
                              {health.courseService === 'UP' ? 'В нормі' : 'Недоступний'}
                            </span>
                          </td>
                        </tr>
                        <tr>
                          <td><strong>Assignment Service</strong></td>
                          <td><code>3002</code></td>
                          <td>Журнал завдань, студенти, оцінювання</td>
                          <td>PostgreSQL (5434)</td>
                          <td>
                            <span className={`studevo-tag ${health.assignmentService === 'UP' ? 'tag-green-verified' : 'tag-orange-fallback'}`}>
                              {health.assignmentService === 'UP' ? 'В нормі' : 'Недоступний'}
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    <div className="studevo-alert studevo-alert-info">
                      <strong>Експеримент відмовостійкості (Вимога ЛР3):</strong>
                      <p style={{ margin: '6px 0 0 0' }}>
                        Якщо <code>Course Service</code> вимкнено, створення завдання в <code>Assignment Service</code> не падає з кодом 500 завдяки вбудованому таймауту 2 секунди та резервному патерну <strong>Fallback</strong>.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VIEW: CALENDAR */}
          {activeNav === 'calendar' && (
            <div className="studevo-card">
              <div className="studevo-card-header">
                <span>Академічний розклад та дедлайни</span>
              </div>
              <div className="studevo-card-body">
                <p style={{ color: '#4b5563' }}>
                  Тут відображаються заплановані лекції, лабораторні здачі та вебінари платформи Studevo.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ background: '#f9fafb', padding: '16px', borderRadius: '12px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--studevo-red)', marginBottom: '8px' }}>Сьогодні — 15:00</div>
                    <div>Тест з історії України (Модуль 2)</div>
                  </div>
                  <div style={{ background: '#f9fafb', padding: '16px', borderRadius: '12px' }}>
                    <div style={{ fontWeight: 600, color: '#f59e0b', marginBottom: '8px' }}>Завтра — 17:00</div>
                    <div>Вебінар: Архітектура мікросервісів та патерни GoF</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* RIGHT SIDEBAR (Matches Photo 2) */}
        <aside className="studevo-sidebar-right">
          {/* Calendar Widget */}
          <div className="widget-card">
            <div className="widget-title-row">
              <h3 className="widget-title">Календар</h3>
              <div className="calendar-arrows">
                <button className="calendar-arrow-btn">&lt;</button>
                <button className="calendar-arrow-btn">&gt;</button>
              </div>
            </div>

            <div className="calendar-days-header">
              <span>Пн</span>
              <span>Вт</span>
              <span>Ср</span>
              <span>Чт</span>
              <span>Пт</span>
              <span>Сб</span>
              <span>Нд</span>
            </div>

            <div className="calendar-dates-grid">
              <div className="calendar-day-cell other-month">28</div>
              <div className="calendar-day-cell other-month">29</div>
              <div className="calendar-day-cell other-month">30</div>
              <div className="calendar-day-cell other-month">31</div>
              <div className="calendar-day-cell highlight-yellow">1</div>
              <div className="calendar-day-cell">2</div>
              <div className="calendar-day-cell">3</div>

              <div className="calendar-day-cell highlight-red">4</div>
              <div className="calendar-day-cell">5</div>
              <div className="calendar-day-cell">6</div>
              <div className="calendar-day-cell highlight-orange">7</div>
              <div className="calendar-day-cell">8</div>
              <div className="calendar-day-cell">9</div>
              <div className="calendar-day-cell">10</div>

              <div className="calendar-day-cell">11</div>
              <div className="calendar-day-cell">12</div>
              <div className="calendar-day-cell">13</div>
              <div className="calendar-day-cell">14</div>
              <div className="calendar-day-cell">15</div>
              <div className="calendar-day-cell">16</div>
              <div className="calendar-day-cell">17</div>

              <div className="calendar-day-cell">18</div>
              <div className="calendar-day-cell">19</div>
              <div className="calendar-day-cell">20</div>
              <div className="calendar-day-cell">21</div>
              <div className="calendar-day-cell">22</div>
              <div className="calendar-day-cell">23</div>
              <div className="calendar-day-cell">24</div>

              <div className="calendar-day-cell">25</div>
              <div className="calendar-day-cell">26</div>
              <div className="calendar-day-cell">27</div>
              <div className="calendar-day-cell">28</div>
              <div className="calendar-day-cell">29</div>
              <div className="calendar-day-cell">30</div>
              <div className="calendar-day-cell">31</div>
            </div>
          </div>

          {/* Upcoming Events Widget */}
          <div className="widget-card">
            <h3 className="widget-title" style={{ marginBottom: '14px' }}>Найближчих подій</h3>
            <div className="upcoming-event-item">
              <div className="event-bar red"></div>
              <span>Тест з історії — 15:00</span>
            </div>
            <div className="upcoming-event-item">
              <div className="event-bar red"></div>
              <span>Лабораторна з архітектури — 17:00</span>
            </div>
            <div className="upcoming-event-item">
              <div className="event-bar orange"></div>
              <span>Вебінар — завтра</span>
            </div>
          </div>

          {/* Platform News Widget */}
          <div className="widget-card">
            <h3 className="widget-title" style={{ marginBottom: '12px' }}>Новини платформи</h3>
            <div className="news-item">
              <div className="news-item-title">
                Дистанційна освіта дистанційного навчання в навчанні на платформі Studevo.
              </div>
              <div className="news-item-date">5 жовтня 2024</div>
            </div>
          </div>
        </aside>
      </div>

      {/* Floating Red Chat Button (Bottom Right) */}
      <button className="floating-chat-bubble" title="Онлайн-підтримка Studevo">
        <svg viewBox="0 0 24 24">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"></path>
        </svg>
      </button>
    </div>
  );
}
