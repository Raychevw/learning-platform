import { useState, useEffect } from 'react';
import './App.css';

export default function App() {
  const [activeTab, setActiveTab] = useState('courses');
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
        setCourses(cData);
        if (cData.length > 0 && !newAssignment.courseId) {
          setNewAssignment((prev) => ({ ...prev, courseId: cData[0].id }));
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
        showNotification(`Курс "${data.title}" успішно зареєстровано в системі.`);
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
        showNotification(`Студента "${data.name}" зареєстровано.`);
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
      {/* Learnova Top Navbar */}
      <header className="learnova-navbar">
        <div className="learnova-brand">
          <div className="learnova-logo">Lear<span>nova</span></div>
          <div className="learnova-tagline">Платформа дистанційного навчання</div>
        </div>
        <div className="learnova-nav-right">
          <div className="status-monitor-pill">
            <span>Шлюз:</span>
            <span className={`status-tag ${health.gateway === 'UP' ? 'online' : 'offline'}`}>
              {health.gateway === 'UP' ? 'В нормі' : 'Збій'}
            </span>
            <span style={{ marginLeft: '6px' }}>Курси:</span>
            <span className={`status-tag ${health.courseService === 'UP' ? 'online' : 'offline'}`}>
              {health.courseService === 'UP' ? 'В нормі' : 'Збій'}
            </span>
            <span style={{ marginLeft: '6px' }}>Завдання:</span>
            <span className={`status-tag ${health.assignmentService === 'UP' ? 'online' : 'offline'}`}>
              {health.assignmentService === 'UP' ? 'В нормі' : 'Збій'}
            </span>
            <button className="btn-red-secondary" style={{ marginLeft: '8px' }} onClick={() => { fetchHealth(); loadAllData(); }}>
              Оновити стан
            </button>
          </div>
          <div className="user-badge">
            Викладач: Адміністратор
          </div>
        </div>
      </header>

      {/* Breadcrumb Navigation */}
      <nav className="learnova-breadcrumbs">
        <ul className="breadcrumbs-list">
          <li>Головна сторінка</li>
          <li>Кабінет викладача</li>
          <li>Керування навчальним процесом</li>
        </ul>
      </nav>

      {/* Main Workspace Optimized for 15.6" Laptop Displays */}
      <main className="learnova-content-wrapper">
        <div className="page-title-banner">
          <h1>Панель керування навчальними курсами</h1>
          <p>Розподілена архітектура: API Gateway (3000), Course Service (3001), Assignment Service (3002)</p>
        </div>

        {/* Notifications */}
        {notification && (
          <div className={`learnova-alert ${notification.isError ? 'learnova-alert-danger' : 'learnova-alert-success'}`}>
            {notification.text}
          </div>
        )}

        {/* Learnova Academic Tabs */}
        <div className="learnova-tabs">
          <button
            className={`tab-button ${activeTab === 'courses' ? 'active' : ''}`}
            onClick={() => setActiveTab('courses')}
          >
            Каталог навчальних курсів
          </button>
          <button
            className={`tab-button ${activeTab === 'assignments' ? 'active' : ''}`}
            onClick={() => setActiveTab('assignments')}
          >
            Завдання та контингент студентів
          </button>
          <button
            className={`tab-button ${activeTab === 'grading' ? 'active' : ''}`}
            onClick={() => setActiveTab('grading')}
          >
            Журнал оцінювання (Патерн Strategy)
          </button>
          <button
            className={`tab-button ${activeTab === 'architecture' ? 'active' : ''}`}
            onClick={() => setActiveTab('architecture')}
          >
            Системна топологія та відмовостійкість
          </button>
        </div>

        {/* Tab 1: Courses */}
        {activeTab === 'courses' && (
          <div className="content-grid-2col">
            <div className="learnova-card">
              <div className="learnova-card-header">Створення нового курсу (Course Service)</div>
              <div className="learnova-card-body">
                <form onSubmit={handleCreateCourse}>
                  <div className="form-field">
                    <label>Повна назва навчальної дисципліни</label>
                    <input
                      type="text"
                      className="input-control"
                      placeholder="наприклад: Архітектура програмного забезпечення"
                      value={newCourse.title}
                      onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-field">
                    <label>Анотація та робоча програма дисципліни</label>
                    <textarea
                      rows="4"
                      className="input-control"
                      placeholder="Короткий опис дисципліни для силабусу..."
                      value={newCourse.description}
                      onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })}
                      required
                    />
                  </div>
                  <button type="submit" className="btn-red-primary" style={{ width: '100%' }}>
                    Зберегти курс
                  </button>
                </form>
              </div>
            </div>

            <div className="learnova-card">
              <div className="learnova-card-header">Реєстр навчальних курсів ({courses.length})</div>
              <div className="learnova-card-body" style={{ padding: 0 }}>
                {courses.length === 0 ? (
                  <div className="empty-caption">
                    {loading ? 'Завантаження списку...' : 'У системі ще немає зареєстрованих курсів.'}
                  </div>
                ) : (
                  <table className="learnova-table">
                    <thead>
                      <tr>
                        <th>Назва курсу</th>
                        <th>Анотація</th>
                        <th>Статус</th>
                        <th>Дії</th>
                      </tr>
                    </thead>
                    <tbody>
                      {courses.map((course) => (
                        <tr key={course.id}>
                          <td><strong>{course.title}</strong></td>
                          <td style={{ color: 'var(--learnova-text-muted)' }}>{course.description}</td>
                          <td>
                            <span className={`badge-tag ${course.isPublished ? 'badge-published' : 'badge-draft'}`}>
                              {course.isPublished ? 'Опубліковано' : 'Чернетка'}
                            </span>
                          </td>
                          <td>
                            {!course.isPublished ? (
                              <button
                                className="btn-red-outline"
                                onClick={() => handlePublishCourse(course.id)}
                              >
                                Опублікувати
                              </button>
                            ) : (
                              <span style={{ fontSize: '12px', color: 'var(--learnova-text-muted)' }}>Доступний студентам</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Assignments & Students */}
        {activeTab === 'assignments' && (
          <div className="content-grid-2col">
            <div>
              <div className="learnova-card">
                <div className="learnova-card-header">Створення завдання (Патерн Builder)</div>
                <div className="learnova-card-body">
                  <form onSubmit={handleCreateAssignment}>
                    <div className="form-field">
                      <label>Вибір курсу</label>
                      <select
                        className="input-control"
                        value={newAssignment.courseId}
                        onChange={(e) => setNewAssignment({ ...newAssignment, courseId: e.target.value })}
                      >
                        {courses.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.title}
                          </option>
                        ))}
                        {courses.length === 0 && <option value="">Немає доступних курсів</option>}
                      </select>
                    </div>
                    <div className="form-field">
                      <label>Тема лабораторної або практичної роботи</label>
                      <input
                        type="text"
                        className="input-control"
                        placeholder="наприклад: Лабораторна робота 3: Проєктування контрактів"
                        value={newAssignment.title}
                        onChange={(e) => setNewAssignment({ ...newAssignment, title: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-field">
                      <label>Максимальна кількість балів</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        className="input-control"
                        value={newAssignment.maxScore}
                        onChange={(e) => setNewAssignment({ ...newAssignment, maxScore: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-field">
                      <label>Кінцевий термін здачі (дедлайн)</label>
                      <input
                        type="datetime-local"
                        className="input-control"
                        value={newAssignment.dueDate}
                        onChange={(e) => setNewAssignment({ ...newAssignment, dueDate: e.target.value })}
                        required
                      />
                    </div>
                    <button type="submit" className="btn-red-primary" style={{ width: '100%' }}>
                      Створити завдання через AssignmentBuilder
                    </button>
                  </form>
                </div>
              </div>

              <div className="learnova-card">
                <div className="learnova-card-header">Зарахування студента</div>
                <div className="learnova-card-body">
                  <form onSubmit={handleRegisterStudent}>
                    <div className="form-field">
                      <label>Прізвище, ім'я студента</label>
                      <input
                        type="text"
                        className="input-control"
                        placeholder="Олександр Петренко"
                        value={newStudent.name}
                        onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-field">
                      <label>Електронна адреса</label>
                      <input
                        type="email"
                        className="input-control"
                        placeholder="o.petrenko@univ.edu.ua"
                        value={newStudent.email}
                        onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                        required
                      />
                    </div>
                    <button type="submit" className="btn-red-secondary" style={{ width: '100%' }}>
                      Зареєструвати в системі
                    </button>
                  </form>
                </div>
              </div>
            </div>

            <div className="learnova-card">
              <div className="learnova-card-header">Журнал виданих завдань ({assignments.length})</div>
              <div className="learnova-card-body" style={{ padding: 0 }}>
                {assignments.length === 0 ? (
                  <div className="empty-caption">
                    {loading ? 'Завантаження завдань...' : 'Завдань не знайдено.'}
                  </div>
                ) : (
                  <table className="learnova-table">
                    <thead>
                      <tr>
                        <th>Тема завдання</th>
                        <th>Дисципліна</th>
                        <th>Макс. бал</th>
                        <th>Кінцевий термін</th>
                        <th>Статус верифікації</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assignments.map((item) => (
                        <tr key={item.id}>
                          <td><strong>{item.title}</strong></td>
                          <td>{item.courseTitle || 'Не визначено'}</td>
                          <td>{item.maxScore}</td>
                          <td>{new Date(item.dueDate).toLocaleDateString()}</td>
                          <td>
                            <span className={`badge-tag ${item.isCourseVerified ? 'badge-verified' : 'badge-fallback'}`}>
                              {item.isCourseVerified ? 'Верифіковано в Course Service' : 'Автономний режим (Fallback)'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Strategy Pattern */}
        {activeTab === 'grading' && (
          <div className="content-grid-2col">
            <div className="learnova-card">
              <div className="learnova-card-header">Параметри оцінювання (Патерн Strategy)</div>
              <div className="learnova-card-body">
                <p style={{ fontSize: '13px', color: 'var(--learnova-text-muted)', marginBottom: '14px' }}>
                  Патерн <strong>Strategy</strong> інкапсулює алгоритми розрахунку підсумкового балу в окремі класи без модифікації базового сервісу.
                </p>
                <form onSubmit={handleCalculateGrade}>
                  <div className="form-field">
                    <label>Схема розрахунку підсумкової оцінки</label>
                    <select
                      className="input-control"
                      value={grading.strategyName}
                      onChange={(e) => setGrading({ ...grading, strategyName: e.target.value })}
                    >
                      <option value="STANDARD">1. StandardGradingStrategy (Базова схема без модифікаторів)</option>
                      <option value="LATE_PENALTY">2. LatePenaltyGradingStrategy (Штраф -20% за порушення дедлайну)</option>
                      <option value="EXCELLENCE_BONUS">3. ExcellenceBonusGradingStrategy (Бонус +5% за якість вчасно)</option>
                    </select>
                  </div>

                  <div className="form-field">
                    <label>Оцінка викладача за критеріями (0 - 100)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      className="input-control"
                      value={grading.rawScore}
                      onChange={(e) => setGrading({ ...grading, rawScore: e.target.value })}
                      required
                    />
                  </div>

                  <button type="submit" className="btn-red-primary" style={{ width: '100%' }}>
                    Розрахувати за обраною стратегією
                  </button>
                </form>
              </div>
            </div>

            <div className="learnova-card">
              <div className="learnova-card-header">Відомість нарахування оцінки</div>
              <div className="learnova-card-body">
                {gradingResult ? (
                  <div style={{ background: '#fffafa', border: '1px solid var(--learnova-border)', padding: '18px', borderRadius: '4px' }}>
                    <div style={{ marginBottom: '12px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--learnova-text-muted)' }}>Застосована стратегія:</span>
                      <div style={{ fontWeight: 600, fontSize: '14px', color: '#1a0808' }}>{gradingResult.strategy}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '40px', margin: '14px 0' }}>
                      <div>
                        <span style={{ fontSize: '12px', color: 'var(--learnova-text-muted)' }}>Початковий бал:</span>
                        <div style={{ fontSize: '24px', fontWeight: 600 }}>{gradingResult.rawScore}</div>
                      </div>
                      <div>
                        <span style={{ fontSize: '12px', color: 'var(--learnova-text-muted)' }}>Підсумковий бал у відомість:</span>
                        <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--learnova-primary)' }}>
                          {gradingResult.finalScore} / 100
                        </div>
                      </div>
                    </div>
                    <div className="learnova-alert learnova-alert-info" style={{ margin: 0 }}>
                      {gradingResult.description}
                    </div>
                  </div>
                ) : (
                  <div className="empty-caption">
                    Оберіть стратегію та вкажіть бали для розрахунку.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Architecture & Fault Tolerance */}
        {activeTab === 'architecture' && (
          <div className="learnova-card">
            <div className="learnova-card-header">Системний моніторинг сервісів та експеримент відмовостійкості</div>
            <div className="learnova-card-body">
              <table className="learnova-table" style={{ marginBottom: '24px' }}>
                <thead>
                  <tr>
                    <th>Сервісний вузол</th>
                    <th>Мережевий порт</th>
                    <th>Зона відповідальності</th>
                    <th>База даних</th>
                    <th>Поточний статус</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>API Gateway</strong></td>
                    <td><code>3000</code></td>
                    <td>Єдина точка входу, Reverse Proxy, маршрутизація</td>
                    <td>Відсутня (Stateless)</td>
                    <td>
                      <span className={`badge-tag ${health.gateway === 'UP' ? 'badge-verified' : 'badge-fallback'}`}>
                        {health.gateway === 'UP' ? 'В нормі' : 'Недоступний'}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td><strong>Course Service</strong></td>
                    <td><code>3001</code></td>
                    <td>Каталог курсів, навчальна програма, публікація</td>
                    <td><code>course_db</code> (PostgreSQL 5433)</td>
                    <td>
                      <span className={`badge-tag ${health.courseService === 'UP' ? 'badge-verified' : 'badge-fallback'}`}>
                        {health.courseService === 'UP' ? 'В нормі' : 'Недоступний'}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td><strong>Assignment Service</strong></td>
                    <td><code>3002</code></td>
                    <td>Студенти, журнал завдань, розрахунок оцінок</td>
                    <td><code>assignment_db</code> (PostgreSQL 5434)</td>
                    <td>
                      <span className={`badge-tag ${health.assignmentService === 'UP' ? 'badge-verified' : 'badge-fallback'}`}>
                        {health.assignmentService === 'UP' ? 'В нормі' : 'Недоступний'}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="learnova-alert learnova-alert-info">
                <strong>Методика перевірки відмовостійкості системи (Вимога ЛР3, розділ 3.8):</strong>
                <ol style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
                  <li>Зупиніть сервіс курсів у терміналі (<code>docker-compose stop course-service</code>).</li>
                  <li>Перейдіть у вкладку «Завдання та контингент студентів» та створіть нове завдання.</li>
                  <li>
                    <strong>Результат:</strong> Завдяки реалізованому патерну <strong>Fallback</strong> операція не завершиться аварійно з кодом 500. Завдання буде створено зі статусом «Автономний режим (Fallback)».
                  </li>
                </ol>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
