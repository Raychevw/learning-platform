import { useMemo } from 'react';

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

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('uk-UA', { day: '2-digit', month: 'short' });
}

export default function Dashboard({
  userRole,
  currentUser,
  courses,
  assignments,
  grades,
  webinars,
  academicGroups,
  ungradedSubmissions,
  averageStudentGrade,
  getEctsLetter,
  onOpenCourse,
  onOpenAssignment,
  onOpenGrades,
  onOpenWebinars,
  onOpenGroups,
}) {
  const isStudent = userRole === 'student';
  const isTeacher = userRole === 'teacher';

  const visibleCourses = useMemo(
    () => (isStudent ? courses.filter((course) => course.isPublished !== false) : courses),
    [courses, isStudent]
  );

  const upcoming = useMemo(() => {
    return assignments
      .filter((assignment) => assignment.deadline)
      .map((assignment) => ({ ...assignment, days: daysUntil(assignment.deadline) }))
      .sort((a, b) => (a.days ?? 9999) - (b.days ?? 9999))
      .slice(0, 5);
  }, [assignments]);

  const pendingCount = useMemo(() => {
    if (!isStudent) return ungradedSubmissions.length;
    return assignments.filter((assignment) => {
      const days = daysUntil(assignment.deadline);
      if (days !== null && days < 0) return false;
      return !(assignment.submissions || []).some((submission) => submission.studentId === currentUser?.id);
    }).length;
  }, [assignments, ungradedSubmissions.length, isStudent, currentUser?.id]);

  const liveWebinars = webinars.filter((webinar) => webinar.status === 'LIVE');
  const nextWebinars = webinars.filter((webinar) => webinar.status !== 'FINISHED').slice(0, 3);
  const recentGrades = grades.slice(0, 4);

  const roleLabel = isStudent ? 'Студент' : isTeacher ? 'Викладач' : 'Адміністратор';

  return (
    <div className="dash">
      <div className="page-head">
        <div>
          <h1>Панель</h1>
          <p>
            {currentUser?.name || ''}
            {currentUser?.dept ? ` • ${currentUser.dept}` : ''}
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

      <div className="dash-stats">
        <div className="dash-stat">
          <span>{isTeacher ? 'Мої курси' : 'Доступні курси'}</span>
          <b>{visibleCourses.length}</b>
        </div>
        <div className="dash-stat">
          <span>{isStudent ? 'До здачі' : isTeacher ? 'На перевірку' : 'Завдання'}</span>
          <b>{pendingCount}</b>
        </div>
        <div className="dash-stat">
          <span>{isStudent ? 'Середній бал' : isTeacher ? 'Найближчий вебінар' : 'Групи'}</span>
          <b>
            {isStudent
              ? `${averageStudentGrade} ${getEctsLetter(averageStudentGrade)}`
              : isTeacher
                ? nextWebinars[0]
                  ? formatDate(nextWebinars[0].scheduledAt)
                  : '—'
                : academicGroups.length}
          </b>
        </div>
      </div>

      <div className="dash-grid">
        <section className="dash-section">
          <div className="dash-section-head">
            <h2>{isTeacher ? 'Мої курси' : 'Мої курси'}</h2>
            <button type="button" className="link-btn" onClick={onOpenGrades}>
              {isStudent ? 'Оцінки' : 'Оцінювання'}
            </button>
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
                      <div className="progress">
                        <span style={{ width: `${progress}%` }} />
                      </div>
                      <div className="course-card-meta">{progress}% пройдено</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <div className="dash-column">
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

          {isStudent ? (
            <section className="dash-section">
              <div className="dash-section-head">
                <h2>Останні оцінки</h2>
              </div>
              {recentGrades.length === 0 ? (
                <p className="dash-empty">Оцінок ще немає.</p>
              ) : (
                <ul className="dash-list">
                  {recentGrades.map((grade) => (
                    <li key={grade.id} className="dash-item">
                      <span className="dash-item-date">{grade.finalScore}</span>
                      <span className="dash-item-main">
                        <span className="dash-item-title">{grade.assignmentTitle}</span>
                        <span className="dash-item-sub">
                          {grade.courseTitle} • {grade.ruleDesc}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : isTeacher ? (
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
          ) : (
            <section className="dash-section">
              <div className="dash-section-head">
                <h2>Адміністрування</h2>
              </div>
              <div className="quick-links">
                <button type="button" className="quick-link" onClick={onOpenGroups}>
                  Користувачі та групи
                </button>
                <button type="button" className="quick-link" onClick={onOpenGrades}>
                  Відомості оцінок
                </button>
                <button type="button" className="quick-link" onClick={onOpenWebinars}>
                  Онлайн-заняття
                </button>
              </div>
            </section>
          )}

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
        </div>
      </div>
    </div>
  );
}
