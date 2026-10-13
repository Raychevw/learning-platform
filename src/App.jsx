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
    assignmentId: '',
    studentId: '',
    rawScore: 95,
    strategyName: 'STANDARD',
  });
  const [gradingResult, setGradingResult] = useState(null);

  useEffect(() => {
    fetchHealth();
    loadAllData();
  }, []);

  const showNotification = (msg, isError = false) => {
    setNotification({ text: msg, isError });
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
      // Fetch Courses
      const cRes = await fetch('/api/courses').catch(() => null);
      if (cRes && cRes.ok) {
        const cData = await cRes.json();
        setCourses(cData);
        if (cData.length > 0 && !newAssignment.courseId) {
          setNewAssignment((prev) => ({ ...prev, courseId: cData[0].id }));
        }
      }

      // Fetch Assignments
      const aRes = await fetch('/api/assignments').catch(() => null);
      if (aRes && aRes.ok) {
        const aData = await aRes.json();
        setAssignments(aData);
        if (aData.length > 0 && !grading.assignmentId) {
          setGrading((prev) => ({ ...prev, assignmentId: aData[0].id }));
        }
      }
    } catch (err) {
      console.warn('Error loading dashboard data:', err);
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
        showNotification(`✅ Курс "${data.title}" успішно створено!`);
        setNewCourse({ title: '', description: '' });
        loadAllData();
      } else {
        const err = await res.json();
        showNotification(`❌ Помилка: ${err.message}`, true);
      }
    } catch (err) {
      showNotification(`❌ Помилка запиту до API Gateway: ${err.message}`, true);
    }
  };

  const handlePublishCourse = async (courseId) => {
    try {
      const res = await fetch(`/api/courses/${courseId}/publish`, { method: 'POST' });
      if (res.ok) {
        showNotification(`🚀 Курс опубліковано! Подія course.published надіслана в Redis. Assignment Service фоново створює Welcome Quiz.`);
        loadAllData();
      } else {
        const err = await res.json();
        showNotification(`❌ Помилка публікації: ${err.message}`, true);
      }
    } catch (err) {
      showNotification(`❌ Помилка мережі: ${err.message}`, true);
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
        showNotification(`🎓 Студента "${data.name}" успішно зареєстровано!`);
        setStudents((prev) => [...prev, data]);
        setNewStudent({ name: '', email: '' });
      } else {
        const err = await res.json();
        showNotification(`❌ Помилка: ${err.message}`, true);
      }
    } catch (err) {
      showNotification(`❌ Помилка реєстрації: ${err.message}`, true);
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
          ? `⚠️ Завдання створено з Fallback деградацією (${data.fallbackNotice})`
          : `✅ Завдання створено (Builder pattern) та верифіковано через Course Service!`;
        showNotification(notice, Boolean(data.fallbackNotice));
        setNewAssignment((prev) => ({ ...prev, title: '' }));
        loadAllData();
      } else {
        const err = await res.json();
        showNotification(`❌ Помилка: ${err.message}`, true);
      }
    } catch (err) {
      showNotification(`❌ Помилка мережі: ${err.message}`, true);
    }
  };

  const handleCalculateGrade = (e) => {
    e.preventDefault();
    const raw = Number(grading.rawScore);
    let final = raw;
    let explanation = '';

    if (grading.strategyName === 'STANDARD') {
      final = Math.min(raw, 100);
      explanation = 'Стандартна стратегія: оцінка нараховується без модифікаторів.';
    } else if (grading.strategyName === 'LATE_PENALTY') {
      final = Math.round(raw * 0.8 * 100) / 100;
      explanation = 'Стратегія штрафу (LatePenalty): застосовано -20% за прострочений дедлайн.';
    } else if (grading.strategyName === 'EXCELLENCE_BONUS') {
      const bonus = raw >= 90 ? Math.min(100, raw + 5) : raw;
      final = bonus;
      explanation = 'Бонусна стратегія (ExcellenceBonus): додано +5% за високий результат вчасно.';
    }

    setGradingResult({
      strategy: grading.strategyName,
      rawScore: raw,
      finalScore: final,
      explanation,
    });
  };

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="dashboard-header">
        <div className="title-group">
          <h1>Learning Platform | Distributed Architecture</h1>
          <p>Мікросервісна система: Clean Architecture • API Gateway • Redis Events • GoF Patterns</p>
        </div>

        {/* Live Service Health Status */}
        <div className="status-bar">
          <div className="status-pill">
            <span className={`dot ${health.gateway === 'UP' ? 'up' : 'down'}`}></span>
            Gateway (3000)
          </div>
          <div className="status-pill">
            <span className={`dot ${health.courseService === 'UP' ? 'up' : 'down'}`}></span>
            Courses (3001)
          </div>
          <div className="status-pill">
            <span className={`dot ${health.assignmentService === 'UP' ? 'up' : 'down'}`}></span>
            Assignments (3002)
          </div>
          <button className="refresh-btn" onClick={() => { fetchHealth(); loadAllData(); }}>
            🔄 Оновити
          </button>
        </div>
      </header>

      {/* Notifications */}
      {notification && (
        <div className="notification-banner" style={{ borderLeftColor: notification.isError ? '#f43f5e' : '#38bdf8' }}>
          <span>{notification.text}</span>
          <button className="refresh-btn" onClick={() => setNotification(null)}>✕</button>
        </div>
      )}

      {/* Tabs navigation */}
      <nav className="tabs-nav">
        <button
          className={`tab-btn ${activeTab === 'courses' ? 'active' : ''}`}
          onClick={() => setActiveTab('courses')}
        >
          📚 Каталог курсів (Course Service)
        </button>
        <button
          className={`tab-btn ${activeTab === 'assignments' ? 'active' : ''}`}
          onClick={() => setActiveTab('assignments')}
        >
          📝 Завдання та Студенти (Builder Pattern)
        </button>
        <button
          className={`tab-btn ${activeTab === 'grading' ? 'active' : ''}`}
          onClick={() => setActiveTab('grading')}
        >
          ⚖️ Оцінювання робіт (Strategy Pattern)
        </button>
        <button
          className={`tab-btn ${activeTab === 'architecture' ? 'active' : ''}`}
          onClick={() => setActiveTab('architecture')}
        >
          🛡️ Відмовостійкість & Топологія
        </button>
      </nav>

      {/* Tab 1: Course Service */}
      {activeTab === 'courses' && (
        <div className="card-grid">
          <div className="panel-card">
            <h2>➕ Створити новий курс</h2>
            <form onSubmit={handleCreateCourse}>
              <div className="form-group">
                <label>Назва курсу</label>
                <input
                  type="text"
                  placeholder="напр. Розподілені системи та DDD"
                  value={newCourse.title}
                  onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Опис навчальної програми</label>
                <textarea
                  rows="4"
                  placeholder="Опис курсу для публікації..."
                  value={newCourse.description}
                  onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })}
                  required
                />
              </div>
              <button type="submit" className="primary-btn">
                Створити чернетку курсу
              </button>
            </form>
          </div>

          <div className="panel-card">
            <h2>📖 Каталог курсів ({courses.length})</h2>
            {courses.length === 0 ? (
              <div className="empty-placeholder">
                {loading ? 'Завантаження курсів...' : 'Немає курсів. Створіть перший курс ліворуч!'}
              </div>
            ) : (
              <div className="items-list">
                {courses.map((course) => (
                  <div key={course.id} className="item-card">
                    <div className="item-info">
                      <h3>{course.title}</h3>
                      <p>{course.description}</p>
                      <span className={`badge ${course.isPublished ? 'published' : 'draft'}`}>
                        {course.isPublished ? '● ОПУБЛІКОВАНО' : '○ ЧЕРНЕТКА'}
                      </span>
                    </div>
                    {!course.isPublished && (
                      <button
                        className="action-btn"
                        onClick={() => handlePublishCourse(course.id)}
                        title="Опублікувати курс та відправити подію в Redis"
                      >
                        🚀 Опублікувати (Event)
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Assignment Service */}
      {activeTab === 'assignments' && (
        <div className="card-grid">
          <div className="panel-card">
            <h2>➕ Створити завдання (через Builder)</h2>
            <form onSubmit={handleCreateAssignment}>
              <div className="form-group">
                <label>Прив'язка до курсу</label>
                <select
                  value={newAssignment.courseId}
                  onChange={(e) => setNewAssignment({ ...newAssignment, courseId: e.target.value })}
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                  {courses.length === 0 && <option value="">Немає курсів (буде використано id за замовчуванням)</option>}
                </select>
              </div>
              <div className="form-group">
                <label>Тема завдання</label>
                <input
                  type="text"
                  placeholder="напр. Лабораторна 3: Сервісні контракти"
                  value={newAssignment.title}
                  onChange={(e) => setNewAssignment({ ...newAssignment, title: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Максимальний бал</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={newAssignment.maxScore}
                  onChange={(e) => setNewAssignment({ ...newAssignment, maxScore: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Дедлайн (має бути в майбутньому)</label>
                <input
                  type="datetime-local"
                  value={newAssignment.dueDate}
                  onChange={(e) => setNewAssignment({ ...newAssignment, dueDate: e.target.value })}
                  required
                />
              </div>
              <button type="submit" className="primary-btn">
                Створити через AssignmentBuilder
              </button>
            </form>

            <hr style={{ borderColor: 'var(--border-color)', margin: '24px 0 16px 0' }} />

            <h2>🎓 Швидка реєстрація студента</h2>
            <form onSubmit={handleRegisterStudent}>
              <div className="form-group">
                <label>ПІБ Студента</label>
                <input
                  type="text"
                  placeholder="Олександр Петренко"
                  value={newStudent.name}
                  onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  placeholder="petrenko@univ.edu"
                  value={newStudent.email}
                  onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                />
              </div>
              <button type="submit" className="action-btn" style={{ width: '100%', padding: '10px' }}>
                Зареєструвати студента
              </button>
            </form>
          </div>

          <div className="panel-card">
            <h2>📋 Список завдань ({assignments.length})</h2>
            {assignments.length === 0 ? (
              <div className="empty-placeholder">
                {loading ? 'Завантаження завдань...' : 'Завдань ще немає. Опублікуйте курс або створіть вручну!'}
              </div>
            ) : (
              <div className="items-list">
                {assignments.map((item) => (
                  <div key={item.id} className="item-card">
                    <div className="item-info">
                      <h3>{item.title}</h3>
                      <p>Курс: <strong>{item.courseTitle || 'Не вказано'}</strong></p>
                      <p>Макс. бал: {item.maxScore} • Дедлайн: {new Date(item.dueDate).toLocaleDateString()}</p>
                      <span className={`badge ${item.isCourseVerified ? 'verified' : 'unverified'}`}>
                        {item.isCourseVerified ? '🟢 Верифіковано через Course Service' : '🟡 Fallback: Неверифікований (офлайн)'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Strategy Pattern */}
      {activeTab === 'grading' && (
        <div className="card-grid">
          <div className="panel-card">
            <h2>⚙️ Калькулятор оцінювання (Strategy Pattern)</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px' }}>
              Патерн <strong>Strategy</strong> дозволяє застосовувати різні алгоритми нарахування балів без зміни логіки контролера.
            </p>
            <form onSubmit={handleCalculateGrade}>
              <div className="form-group">
                <label>Оберіть стратегію нарахування балів</label>
                <select
                  value={grading.strategyName}
                  onChange={(e) => setGrading({ ...grading, strategyName: e.target.value })}
                >
                  <option value="STANDARD">1. StandardGradingStrategy (Без штрафів і бонусів)</option>
                  <option value="LATE_PENALTY">2. LatePenaltyGradingStrategy (-20% за прострочення)</option>
                  <option value="EXCELLENCE_BONUS">3. ExcellenceBonusGradingStrategy (+5% за відмінний результат)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Початкова оцінка викладача (0 - 100)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={grading.rawScore}
                  onChange={(e) => setGrading({ ...grading, rawScore: e.target.value })}
                  required
                />
              </div>

              <button type="submit" className="primary-btn">
                Застосувати стратегію оцінки
              </button>
            </form>
          </div>

          <div className="panel-card">
            <h2>📊 Результат розрахунку</h2>
            {gradingResult ? (
              <div style={{ background: 'var(--bg-secondary)', padding: '20px', borderRadius: '10px' }}>
                <p style={{ fontSize: '14px', marginBottom: '8px' }}>Застосована стратегія: <strong>{gradingResult.strategy}</strong></p>
                <div style={{ display: 'flex', gap: '30px', margin: '16px 0' }}>
                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Початкова оцінка:</span>
                    <h3 style={{ fontSize: '28px', margin: '4px 0' }}>{gradingResult.rawScore}</h3>
                  </div>
                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Підсумкова оцінка:</span>
                    <h3 style={{ fontSize: '28px', margin: '4px 0', color: 'var(--accent-blue)' }}>{gradingResult.finalScore} / 100</h3>
                  </div>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--accent-green)', background: 'rgba(34, 197, 94, 0.1)', padding: '10px', borderRadius: '6px' }}>
                  💡 {gradingResult.explanation}
                </p>
              </div>
            ) : (
              <div className="empty-placeholder">
                Оберіть стратегію та натисніть «Застосувати стратегію оцінки» для розрахунку.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Architecture & Fault Tolerance */}
      {activeTab === 'architecture' && (
        <div className="panel-card">
          <h2>🛡️ Архітектура розподіленої системи та експеримент відмовостійкості</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginTop: '16px' }}>
            <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '10px' }}>
              <h3 style={{ color: 'var(--accent-blue)', margin: '0 0 8px 0', fontSize: '16px' }}>1. API Gateway (Порт 3000)</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Єдина точка входу, яка ховає внутрішні мікросервіси від браузера і робить зворотне проксіювання запитів.
              </p>
            </div>
            <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '10px' }}>
              <h3 style={{ color: 'var(--accent-purple)', margin: '0 0 8px 0', fontSize: '16px' }}>2. Course Service (Порт 3001)</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Власник курсів із власною БД <code>course_db</code> (порт 5433). Публікує події в Redis при зміні стану курсу.
              </p>
            </div>
            <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '10px' }}>
              <h3 style={{ color: 'var(--accent-green)', margin: '0 0 8px 0', fontSize: '16px' }}>3. Assignment Service (Порт 3002)</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Власник завдань та оцінок із власною БД <code>assignment_db</code> (порт 5434). Слухає події та має таймаут-захист.
              </p>
            </div>
          </div>

          <div style={{ background: 'rgba(56, 189, 248, 0.05)', border: '1px solid rgba(56, 189, 248, 0.2)', padding: '20px', borderRadius: '10px', marginTop: '20px' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>🧪 Як провести експеримент відмовостійкості (Fault-Tolerance Test):</h3>
            <ol style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.7', margin: 0, paddingLeft: '20px' }}>
              <li>Зупиніть сервіс курсів у терміналі: <code>docker-compose stop course-service</code></li>
              <li>Спробуйте створити завдання у вкладці «Завдання та Студенти».</li>
              <li>
                <strong>Очікувана поведінка:</strong> Запит не зависне назавжди і не видасть 500 помилку.
                Спрацює 2-секундний таймаут, увімкнеться <strong>Fallback</strong>, і завдання успішно створиться із жовтим бейджем <em>«Fallback: Неверифікований»</em>.
              </li>
              <li>Запустіть сервіс курсів назад: <code>docker-compose start course-service</code></li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
