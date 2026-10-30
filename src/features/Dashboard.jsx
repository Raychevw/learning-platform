import { useMemo } from 'react';
import { modulesLabel, plural, studentsLabel } from '../utils/plural.js';

function daysUntil(deadline) {
  const due = new Date(deadline);
  if (Number.isNaN(due.getTime())) return null;
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfDue = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  return Math.round((startOfDue - startOfToday) / (24 * 60 * 60 * 1000));
}

function deadlineLabel(days) {
  if (days === null) return '';
  if (days < 0) return `прострочено на ${Math.abs(days)} дн.`;
  if (days === 0) return 'сьогодні';
  if (days === 1) return 'завтра';
  return `через ${days} дн.`;
}

function courseProgress(course) {
  if (typeof course.progress === 'number') return course.progress;
  const lessons = (course.modules || []).flatMap((mod) => mod.lessons || []);
  if (lessons.length === 0) return 0;
  return Math.round((lessons.filter((lesson) => lesson.completed).length / lessons.length) * 100);
}

const WEEKDAYS = ['Понеділок', 'Вівторок', 'Середа', 'Четвер', "П'ятниця", 'Субота', 'Неділя'];

function assignmentStatus(assignment, userId) {
  const submission = (assignment.submissions || []).find((item) => item.studentId === userId);
  if (submission?.status === 'GRADED') return { label: `Оцінено ${submission.score ?? ''}`.trim(), tone: 'done' };
  if (submission) return { label: 'Здано', tone: 'done' };
  const days = daysUntil(assignment.deadline);
  if (days !== null && days < 0) return { label: 'Прострочено', tone: 'overdue' };
  return { label: 'До здачі', tone: 'pending' };
}

function worksLabel(count) {
  return `${count} ${plural(count, 'робота очікує', 'роботи очікують', 'робіт очікують')} перевірки`;
}

function messagesLabel(count) {
  return `${count} ${plural(count, 'непрочитане повідомлення', 'непрочитані повідомлення', 'непрочитаних повідомлень')}`;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('uk-UA', { day: '2-digit', month: 'short' });
}

/** Компактні іконки для плиток статистики. */
function StatIcon({ name }) {
  const paths = {
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    groups: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
    alert: (
      <>
        <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    book: (
      <>
        <path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z" />
        <path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z" />
      </>
    ),
    check: (
      <>
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </>
    ),
    chart: (
      <>
        <path d="M3 3v18h18" />
        <path d="M7 15l4-4 3 3 5-6" />
      </>
    ),
  };

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name] || paths.groups}
    </svg>
  );
}


export default function Dashboard({
  userRole,
  currentUser,
  courses,
  assignments,
  grades,
  webinars,
  academicGroups,
  schedule = [],
  allEnrollments = [],
  analytics = null,
  announcements = [],
  myGroup = null,
  semester = 1,
  ungradedSubmissions,
  unreadMessages = 0,
  averageStudentGrade,
  getEctsLetter,
  onOpenCourse,
  onOpenAssignment,
  onOpenGrades,
  onOpenWebinars,
  onOpenGroups,
  onOpenSchedule,
  onOpenAnnouncements,
  onOpenMessages,
}) {
  const isStudent = userRole === 'student';
  const isTeacher = userRole === 'teacher';
  const isAdmin = userRole === 'admin';
  const totalStudents = academicGroups.reduce((sum, group) => sum + (Number(group.studentsCount) || 0), 0);
  const teacherStudentCount = new Set((allEnrollments || []).map((item) => item.userId)).size;

  const studentsForCourse = (courseId) => {
    const groupIds = (academicGroups || [])
      .filter((group) => (group.assignedCourseIds || []).includes(courseId))
      .map((group) => group.id);
    return new Set(
      (allEnrollments || []).filter((item) => groupIds.includes(item.groupId)).map((item) => item.userId)
    ).size;
  };

  const averageForCourse = (courseTitle) => {
    const items = grades.filter((grade) => grade.courseTitle === courseTitle);
    if (items.length === 0) return null;
    const sum = items.reduce((acc, grade) => acc + Number(grade.finalScore || 0), 0);
    return (sum / items.length).toFixed(1);
  };

  const visibleCourses = useMemo(() => {
    if (isStudent) return courses.filter((course) => course.isPublished !== false);
    if (isTeacher) {
      return courses.filter((course) => !course.ownerId || course.ownerId === currentUser?.id);
    }
    return courses;
  }, [courses, isStudent, isTeacher, currentUser?.id]);

  const upcoming = useMemo(() => {
    return assignments
      .filter((assignment) => assignment.deadline)
      .filter((assignment) => {
        const days = daysUntil(assignment.deadline);
        if (days !== null && days < 0) return false;
        if (isStudent && (assignment.submissions || []).some((submission) => submission.studentId === currentUser?.id)) {
          return false;
        }
        return true;
      })
      .map((assignment) => ({ ...assignment, days: daysUntil(assignment.deadline) }))
      .sort((a, b) => (a.days ?? 9999) - (b.days ?? 9999))
      .slice(0, 5);
  }, [assignments, isStudent, currentUser?.id]);

  const pendingCount = useMemo(() => {
    if (!isStudent) return ungradedSubmissions.length;
    return assignments.filter((assignment) => {
      const days = daysUntil(assignment.deadline);
      if (days !== null && days < 0) return false;
      return !(assignment.submissions || []).some((submission) => submission.studentId === currentUser?.id);
    }).length;
  }, [assignments, ungradedSubmissions.length, isStudent, currentUser?.id]);

  // Деканат (admin) не працює з онлайн-заняттями — не показуємо цей блок.
  const showWebinars = userRole !== 'admin';
  const liveWebinars = showWebinars ? webinars.filter((webinar) => webinar.status === 'LIVE') : [];
  const nextWebinars = showWebinars ? webinars.filter((webinar) => webinar.status !== 'FINISHED').slice(0, 3) : [];
  const recentGrades = grades.slice(0, 6);
  const debts = grades.filter((grade) => Number(grade.finalScore) < 60).length;

  const notifications = [];
  if (unreadMessages > 0) {
    notifications.push({
      id: 'messages',
      tone: 'info',
      icon: '✉',
      title: messagesLabel(unreadMessages),
      subtitle: 'Відкрийте, щоб відповісти',
      action: onOpenMessages,
    });
  }
  if (isTeacher && ungradedSubmissions.length > 0) {
    notifications.push({
      id: 'ungraded',
      tone: 'warning',
      icon: '⏳',
      title: worksLabel(ungradedSubmissions.length),
      subtitle: 'Перейдіть до оцінювання',
      action: onOpenGrades,
    });
  }
  if (isStudent) {
    for (const assignment of upcoming.slice(0, 2)) {
      notifications.push({
        id: `deadline-${assignment.id}`,
        tone: assignment.days !== null && assignment.days <= 2 ? 'urgent' : 'info',
        icon: '⏰',
        title: assignment.title,
        subtitle:
          assignment.days !== null && assignment.days >= 0
            ? `Дедлайн через ${assignment.days} дн.`
            : 'Дедлайн наближається',
        action: () => onOpenAssignment(assignment.id),
      });
    }
  }

  const totals = analytics?.totals || {};
  const groupStats = analytics?.groupStats || [];
  const riskStudents = analytics?.riskStudents || [];
  const pendingByCourse = analytics?.pendingByCourse || [];

  const statTiles = isAdmin
    ? [
        { label: 'Студенти', value: totals.students ?? totalStudents, icon: 'users', tone: 'red' },
        { label: 'Групи', value: totals.groups ?? academicGroups.length, icon: 'groups', tone: 'slate' },
        { label: 'Борги', value: totals.debts ?? 0, icon: 'alert', tone: 'amber' },
        { label: 'На перевірці', value: totals.ungraded ?? 0, icon: 'clock', tone: 'blue' },
      ]
    : [
        {
          label: isTeacher ? 'Мої курси' : 'Доступні курси',
          value: visibleCourses.length,
          icon: 'book',
          tone: 'red',
        },
        {
          label: isStudent ? 'До здачі' : 'На перевірку',
          value: pendingCount,
          icon: isStudent ? 'check' : 'clock',
          tone: isStudent ? 'blue' : 'amber',
        },
        {
          label: isStudent ? 'Середній бал' : 'Студенти',
          value: isStudent
            ? `${averageStudentGrade} ${getEctsLetter(averageStudentGrade)}`
            : teacherStudentCount,
          icon: isStudent ? 'chart' : 'users',
          tone: isStudent ? 'green' : 'slate',
        },
      ];

  const exportAnalytics = () => {
    if (!analytics) return;
    const rows = [
      ['Група', 'Студенти', 'Середній бал', 'Борги'],
      ...groupStats.map((group) => [
        group.name,
        group.students,
        group.avgScore ?? '',
        group.debts,
      ]),
      [],
      ['Студент', 'Група', 'Середній бал', 'Борги', 'Пропущені роботи'],
      ...riskStudents.map((student) => [
        student.studentName,
        student.group,
        student.avgScore ?? '',
        student.debts,
        student.missing,
      ]),
    ];
    const csv =
      '\uFEFF' + rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Звіт_успішність_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const roleLabel = isStudent ? 'Студент' : isTeacher ? 'Викладач' : 'Деканат';

  return (
    <div className="dash">
      <div className="page-head">
        <div>
          <h1>Панель</h1>
          <p>
            {currentUser?.name || ''}
            {isStudent && myGroup
              ? ` • ${[
                  myGroup.faculty,
                  myGroup.specialty,
                  `група ${myGroup.name}`,
                  `${semester} семестр`,
                ]
                  .filter(Boolean)
                  .join(' • ')}`
              : currentUser?.dept
                ? ` • ${currentUser.dept}`
                : ''}
          </p>
        </div>
        <span className="role-chip">{roleLabel}</span>
      </div>

      {liveWebinars.length > 0 && (
        <button type="button" className="live-banner" onClick={onOpenWebinars}>
          <span className="live-dot" />
          <span>
            Зараз в ефірі: <strong>{liveWebinars[0].title}</strong>
          </span>
          <span className="live-banner-action">Приєднатися</span>
        </button>
      )}

      <div className={`dash-stats ${isAdmin ? 'dash-stats-4' : ''}`}>
        {statTiles.map((tile) => (
          <div key={tile.label} className={`dash-stat tone-${tile.tone || 'red'}`}>
            <span className="dash-stat-icon">
              <StatIcon name={tile.icon} />
            </span>
            <span className="dash-stat-body">
              <span className="dash-stat-label">{tile.label}</span>
              <b>{tile.value}</b>
            </span>
          </div>
        ))}
      </div>

      {notifications.length > 0 && (
        <section className="dash-section">
          <div className="dash-section-head">
            <h2>Сповіщення</h2>
          </div>
          <div className="notif-list">
            {notifications.slice(0, 5).map((item) => (
              <button
                key={item.id}
                type="button"
                className={`notif-item ${item.tone}`}
                onClick={item.action}
              >
                <span className="notif-icon">{item.icon}</span>
                <span className="notif-main">
                  <span className="notif-title">{item.title}</span>
                  <span className="notif-subtitle">{item.subtitle}</span>
                </span>
                <span className="notif-arrow">→</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {announcements.length > 0 && (
        <section className="dash-section">
          <div className="dash-section-head">
            <h2>Оголошення</h2>
            <button type="button" className="link-btn" onClick={onOpenAnnouncements}>
              Усі
            </button>
          </div>
          {announcements.slice(0, 2).map((item) => (
            <div key={item.id} className="dash-announcement">
              <div className="dash-item-title">{item.title}</div>
              <div className="dash-item-sub">
                {item.authorName} • {formatDate(item.createdAt)}
              </div>
              <div className="dash-announcement-body">{item.body}</div>
            </div>
          ))}
        </section>
      )}

      {schedule.length > 0 && (
        <section className="dash-section">
          <div className="dash-section-head">
            <h2>Розклад занять</h2>
            <span className="dash-hint">{myGroup ? `Група ${myGroup.name}` : 'Поточний тиждень'}</span>
          </div>
          <div className="schedule-grid">
            {WEEKDAYS.map((label, index) => {
              const items = schedule.filter((entry) => Number(entry.weekday) === index + 1);
              if (items.length === 0) return null;
              return (
                <div key={label} className="schedule-day">
                  <div className="schedule-day-name">{label}</div>
                  {items.map((entry) => (
                    <div key={entry.id} className="schedule-item">
                      <div className="schedule-time">
                        {entry.startTime}–{entry.endTime}
                      </div>
                      <div className="schedule-course">{entry.courseTitle}</div>
                      <div className="schedule-meta">
                        {entry.lessonType}
                        {entry.room ? ` • ауд. ${entry.room}` : ''}
                        {entry.teacherName ? ` • ${entry.teacherName}` : ''}
                      </div>
                      {entry.onlineUrl && (
                        <a className="schedule-link" href={entry.onlineUrl} target="_blank" rel="noreferrer">
                          Приєднатися онлайн
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="dash-grid">
        <section className="dash-section">
          <div className="dash-section-head">
            <h2>{isAdmin ? 'Дисципліни факультету' : 'Мої курси'}</h2>
            {!isAdmin && (
              <button type="button" className="link-btn" onClick={onOpenGrades}>
                {isStudent ? 'Оцінки' : 'Оцінювання'}
              </button>
            )}
          </div>

          {visibleCourses.length === 0 ? (
            <p className="dash-empty">Курсів поки немає.</p>
          ) : (
            <div className="course-list">
              {visibleCourses.slice(0, 6).map((course) => {
                const progress = courseProgress(course);
                return (
                  <button
                    type="button"
                    key={course.id}
                    className="course-card"
                    onClick={() => onOpenCourse(course.id)}
                  >
                    <img src={course.cover || '/course-coding.jpg'} alt="" />
                    <div className="course-card-body">
                      <div className="course-card-title">{course.title}</div>
                      <div className="course-card-meta">{course.instructor || 'Викладач не вказаний'}</div>
                      {isAdmin || isTeacher ? (
                        <>
                          <div className="course-card-meta">
                            {studentsLabel(studentsForCourse(course.id))} •{' '}
                            {modulesLabel((course.modules || []).length)}
                            {isAdmin ? ` • ${course.totalHours || 0} год` : ''}
                          </div>
                          {isTeacher && (
                            <div className="course-card-meta">
                              Середній бал: {averageForCourse(course.title) ?? '—'}
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="progress">
                            <span style={{ width: `${progress}%` }} />
                          </div>
                          <div className="course-card-meta">{progress}% пройдено</div>
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {isStudent && assignments.length > 0 && (
            <div className="dash-subsection">
              <div className="dash-section-head">
                <h2>Мої завдання</h2>
                <button type="button" className="link-btn" onClick={() => onOpenAssignment(assignments[0]?.id)}>
                  Усі
                </button>
              </div>
              <ul className="dash-list">
                {assignments.slice(0, 8).map((assignment) => {
                  const status = assignmentStatus(assignment, currentUser?.id);
                  return (
                    <li key={assignment.id}>
                      <button
                        type="button"
                        className="dash-item dash-item-btn"
                        onClick={() => onOpenAssignment(assignment.id)}
                      >
                        <span className="dash-item-main">
                          <span className="dash-item-title">{assignment.title}</span>
                          <span className="dash-item-sub">
                            {assignment.type || 'Завдання'} • {assignment.courseTitle} • {formatDate(assignment.deadline)}
                          </span>
                        </span>
                        <span className={`dash-status ${status.tone}`}>{status.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>

        <div className="dash-column">
          {!isAdmin && (
          <section className="dash-section">
            <div className="dash-section-head">
              <h2>Найближчі дедлайни</h2>
              <button type="button" className="link-btn" onClick={() => onOpenAssignment(upcoming[0]?.id)}>
                Усі завдання
              </button>
            </div>

            {upcoming.length === 0 ? (
              <p className="dash-empty">Немає активних дедлайнів.</p>
            ) : (
              <ul className="dash-list">
                {upcoming.map((assignment) => (
                  <li key={assignment.id}>
                    <button
                      type="button"
                      className="dash-item dash-item-btn"
                      onClick={() => onOpenAssignment(assignment.id)}
                    >
                      <span className={`dash-item-date ${assignment.days < 0 ? 'overdue' : ''}`}>
                        {formatDate(assignment.deadline)}
                      </span>
                      <span className="dash-item-main">
                        <span className="dash-item-title">{assignment.title}</span>
                        <span className="dash-item-sub">
                          {assignment.courseTitle} • {deadlineLabel(assignment.days)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          )}

          {isStudent ? (
            <section className="dash-section">
              <div className="dash-section-head">
                <h2>Оцінки та успішність</h2>
                <span className="dash-hint">
                  Сер. {averageStudentGrade} • Борги: {debts}
                </span>
              </div>
              {recentGrades.length === 0 ? (
                <p className="dash-empty">Оцінок ще немає.</p>
              ) : (
                <ul className="dash-list">
                  {recentGrades.map((grade) => (
                    <li key={grade.id} className="dash-item">
                      <span className="dash-item-date">
                        {grade.finalScore}/{grade.maxScore}
                      </span>
                      <span className="dash-item-main">
                        <span className="dash-item-title">{grade.assignmentTitle}</span>
                        <span className="dash-item-sub">
                          {grade.courseTitle} • ECTS {getEctsLetter(grade.finalScore)} • {grade.ruleDesc}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : isTeacher ? (
            <>
            <section className="dash-section">
              <div className="dash-section-head">
                <h2>На перевірку</h2>
                <button type="button" className="link-btn" onClick={onOpenGrades}>
                  Відкрити
                </button>
              </div>
              {ungradedSubmissions.length === 0 ? (
                <p className="dash-empty">Усі роботи перевірено.</p>
              ) : (
                <ul className="dash-list">
                  {ungradedSubmissions.slice(0, 5).map((submission) => (
                    <li key={submission.id} className="dash-item">
                      <span className="dash-item-main">
                        <span className="dash-item-title">{submission.studentName}</span>
                        <span className="dash-item-sub">{submission.assignmentTitle}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="dash-section">
              <div className="dash-section-head">
                <h2>Успішність студентів</h2>
              </div>
              <ul className="dash-list">
                {visibleCourses.map((course) => (
                  <li key={course.id} className="dash-item">
                    <span className="dash-item-main">
                      <span className="dash-item-title">{course.title}</span>
                      <span className="dash-item-sub">
                        Середній бал: {averageForCourse(course.title) ?? '—'} •{' '}
                        {studentsLabel(studentsForCourse(course.id))}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
            </>
          ) : (
            <>
            <section className="dash-section">
              <div className="dash-section-head">
                <h2>Адміністрування</h2>
                <button type="button" className="link-btn" onClick={exportAnalytics}>
                  Звіт CSV
                </button>
              </div>
              <div className="quick-links">
                <button type="button" className="quick-link" onClick={onOpenGroups}>
                  Користувачі та групи
                </button>
                <button type="button" className="quick-link" onClick={onOpenGrades}>
                  Відомості оцінок
                </button>
                <button type="button" className="quick-link" onClick={onOpenSchedule}>
                  Розклад занять
                </button>
                <button type="button" className="quick-link" onClick={onOpenAnnouncements}>
                  Оголошення
                </button>
              </div>
            </section>

            <section className="dash-section">
              <div className="dash-section-head">
                <h2>Успішність груп</h2>
              </div>
              {groupStats.length === 0 ? (
                <p className="dash-empty">Даних ще немає.</p>
              ) : (
                <div className="dash-table">
                  <div className="dash-table-row dash-table-head">
                    <span>Група</span>
                    <span>Студ.</span>
                    <span>Сер.</span>
                    <span>Борги</span>
                  </div>
                  {groupStats.map((group) => (
                    <div key={group.groupId} className="dash-table-row">
                      <span>{group.name}</span>
                      <span>{group.students}</span>
                      <span>{group.avgScore ?? '—'}</span>
                      <span className={group.debts > 0 ? 'danger' : ''}>{group.debts}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="dash-section">
              <div className="dash-section-head">
                <h2>Борги та пропуски</h2>
              </div>
              {riskStudents.length === 0 ? (
                <p className="dash-empty">Заборгованостей немає.</p>
              ) : (
                <ul className="dash-list">
                  {riskStudents.slice(0, 6).map((student) => (
                    <li key={student.studentId} className="dash-item">
                      <span className="dash-item-main">
                        <span className="dash-item-title">{student.studentName}</span>
                        <span className="dash-item-sub">
                          {student.group || '—'} • борги: {student.debts} • пропущено: {student.missing}
                        </span>
                      </span>
                      <span className="dash-status overdue">{student.avgScore ?? '—'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {pendingByCourse.length > 0 && (
              <section className="dash-section">
                <div className="dash-section-head">
                  <h2>На перевірці у викладачів</h2>
                </div>
                <ul className="dash-list">
                  {pendingByCourse.map((item) => (
                    <li key={item.courseTitle} className="dash-item">
                      <span className="dash-item-main">
                        <span className="dash-item-title">{item.courseTitle}</span>
                        <span className="dash-item-sub">{worksLabel(item.pending)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            </>
          )}

          {showWebinars && (
            <section className="dash-section">
              <div className="dash-section-head">
                <h2>Онлайн-заняття</h2>
                <button type="button" className="link-btn" onClick={onOpenWebinars}>
                  Розклад
                </button>
              </div>
              {nextWebinars.length === 0 ? (
                <p className="dash-empty">Занять не заплановано.</p>
              ) : (
                <ul className="dash-list">
                  {nextWebinars.map((webinar) => (
                    <li key={webinar.id} className="dash-item">
                      <span className="dash-item-date">{formatDate(webinar.scheduledAt)}</span>
                      <span className="dash-item-main">
                        <span className="dash-item-title">{webinar.title}</span>
                        <span className="dash-item-sub">
                          {webinar.courseTitle} •{' '}
                          {webinar.status === 'LIVE' ? 'в ефірі' : 'заплановано'}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
