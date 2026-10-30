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

const WEEKDAYS = ['Понеділок', 'Вівторок', 'Середа', 'Четвер', "П'ятниця", 'Субота', 'Неділя'];

function assignmentStatus(assignment, userId) {
  const submission = (assignment.submissions || []).find((item) => item.studentId === userId);
  if (submission?.status === 'GRADED') return { label: `Оцінено ${submission.score ?? ''}`.trim(), tone: 'done' };
  if (submission) return { label: 'Здано', tone: 'done' };
  const days = daysUntil(assignment.deadline);
  if (days !== null && days < 0) return { label: 'Прострочено', tone: 'overdue' };
  return { label: 'До здачі', tone: 'pending' };
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
  schedule = [],
  allEnrollments = [],
  myGroup = null,
  semester = 1,
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

  // Деканат (admin) не працює з онлайн-заняттями — не показуємо цей блок.
  const showWebinars = userRole !== 'admin';
  const liveWebinars = showWebinars ? webinars.filter((webinar) => webinar.status === 'LIVE') : [];
  const nextWebinars = showWebinars ? webinars.filter((webinar) => webinar.status !== 'FINISHED').slice(0, 3) : [];
  const recentGrades = grades.slice(0, 6);
  const debts = grades.filter((grade) => Number(grade.finalScore) < 60).length;

  const roleLabel = isStudent ? 'Студент' : isTeacher ? 'Викладач' : 'Адміністратор';

  return (
    <div className="dash">
      <div className="page-head">
        <div>
          <h1>Панель</h1>
          <p>
            {currentUser?.name || ''}
            {isStudent && myGroup
              ? ` • ${[myGroup.faculty, myGroup.specialty, `група ${myGroup.name}`, `${semester} семестр`]
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

      <div className="dash-stats">
        <div className="dash-stat">
          <span>{isAdmin ? 'Курси' : isTeacher ? 'Мої курси' : 'Доступні курси'}</span>
          <b>{visibleCourses.length}</b>
        </div>
        <div className="dash-stat">
          <span>{isAdmin ? 'Групи' : isStudent ? 'До здачі' : 'На перевірку'}</span>
          <b>{isAdmin ? academicGroups.length : pendingCount}</b>
        </div>
        <div className="dash-stat">
          <span>{isAdmin ? 'Студенти' : isStudent ? 'Середній бал' : 'Студенти'}</span>
          <b>
            {isAdmin
              ? totalStudents
              : isStudent
                ? `${averageStudentGrade} ${getEctsLetter(averageStudentGrade)}`
                : teacherStudentCount}
          </b>
        </div>
      </div>

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
            <h2>{isAdmin ? 'Курси' : 'Мої курси'}</h2>
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
                            {studentsForCourse(course.id)} студентів • {(course.modules || []).length} модулів
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
                        {studentsForCourse(course.id)} студентів
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
            </>
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
              </div>

              {academicGroups.length > 0 && (
                <ul className="dash-list dash-list-spaced">
                  {academicGroups.slice(0, 6).map((group) => (
                    <li key={group.id} className="dash-item">
                      <span className="dash-item-main">
                        <span className="dash-item-title">{group.name}</span>
                        <span className="dash-item-sub">
                          {group.studentsCount || 0} студентів • {(group.assignedCourseIds || []).length} курсів
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
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
