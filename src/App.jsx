import { useState, useEffect, useMemo } from 'react';
import './App.css';
import './styles/clean.css';
import { api, getToken, request, requestBlob } from './api/client.js';
import Dashboard from './features/Dashboard.jsx';
import WebinarsPage from './features/WebinarsPage.jsx';
import { useAuth } from './auth/useAuth.js';
import { newId } from './lib/id.js';
import { modulesLabel, studentsLabel } from './utils/plural.js';
import {
  INITIAL_COURSES,
  INITIAL_ASSIGNMENTS,
  INITIAL_GRADES,
  INITIAL_GROUPS,
  INITIAL_WEBINARS,
  INITIAL_AUDIT_LOGS,
  INITIAL_EVENTS,
} from './data/seed.js';

function getEctsLetter(score) {
  const num = Number(score) || 0;
  if (num >= 90) return 'A';
  if (num >= 82) return 'B';
  if (num >= 74) return 'C';
  if (num >= 64) return 'D';
  if (num >= 60) return 'E';
  return 'FX';
}

/** Ближайший круглый час для формы планирования вебинара. */
function getDefaultWebinarDate() {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(0);
  d.setSeconds(0);
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
}

/** Ініціали для аватарів у повідомленнях. */
function initialsOf(name) {
  return String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

/** Українське відмінювання для кількості навчальних матеріалів. */
function materialCountLabel(count) {
  const n = Number(count) || 0;
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} матеріал`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} матеріали`;
  return `${n} матеріалів`;
}

/** Дедлайн за замовчуванням — через 7 днів, 23:59. */
function getDefaultDeadline(days = 7) {
  const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  d.setHours(23, 59, 0, 0);
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
}

function calcCourseProgress(modules) {
  if (!modules || modules.length === 0) return 0;
  const allLessons = modules.flatMap((m) => m.lessons || []);
  if (allLessons.length === 0) return 0;
  const completedCount = allLessons.filter((l) => l.completed).length;
  return Math.round((completedCount / allLessons.length) * 100);
}

const UK_MONTHS = [
  'Січень',
  'Лютий',
  'Березень',
  'Квітень',
  'Травень',
  'Червень',
  'Липень',
  'Серпень',
  'Вересень',
  'Жовтень',
  'Листопад',
  'Грудень',
];

export default function App() {
  const { user: currentUser, booting, login, logout, refreshProfile } = useAuth();

  // Login Form States
  const [loginInput, setLoginInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');

  const userRole = currentUser ? currentUser.role : 'student';
  const [activeMenu, setActiveMenu] = useState('dashboard');

  // Core Data States. Seed-данные используются только как offline-демо:
  // как только backend отвечает, источником истины становится PostgreSQL.
  const [courses, setCourses] = useState(INITIAL_COURSES);
  const [assignments, setAssignments] = useState(INITIAL_ASSIGNMENTS);
  const [grades, setGrades] = useState(INITIAL_GRADES);
  const [academicGroups, setAcademicGroups] = useState(INITIAL_GROUPS);
  const [webinars, setWebinars] = useState(INITIAL_WEBINARS);
  const [schedule, setSchedule] = useState([]);
  const [allEnrollments, setAllEnrollments] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [directory, setDirectory] = useState([]);
  const [inboxMessages, setInboxMessages] = useState([]);
  const [sentMessages, setSentMessages] = useState([]);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [composeForm, setComposeForm] = useState({ recipientId: '', subject: '', body: '' });
  const [messagePeer, setMessagePeer] = useState(null);
  const [threadMessages, setThreadMessages] = useState([]);
  const [replyBody, setReplyBody] = useState('');
  const [threadLoading, setThreadLoading] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    body: '',
    audience: 'ALL',
    groupId: '',
  });
  const [scheduleForm, setScheduleForm] = useState({
    courseId: '',
    groupId: '',
    weekday: 1,
    startTime: '09:00',
    endTime: '10:30',
    room: '',
    lessonType: 'Лекція',
    onlineUrl: '',
  });
  const [auditLogs, setAuditLogs] = useState(INITIAL_AUDIT_LOGS);
  const [eventsFeed, setEventsFeed] = useState(INITIAL_EVENTS);

  // Загрузка живых данных через API Gateway после входа.
  useEffect(() => {
    if (!currentUser) return undefined;
    let isCancelled = false;

    const load = async () => {
      const userId = encodeURIComponent(currentUser.id);
      const [
        catalog,
        assignmentsRes,
        gradesRes,
        groupsRes,
        webinarsRes,
        scheduleRes,
        enrollmentsRes,
        analyticsRes,
        directoryRes,
        inboxRes,
        sentRes,
        unreadRes,
      ] = await Promise.allSettled([
          api.get(`/api/catalog?userId=${userId}`),
          api.get('/api/assignments-full'),
          api.get('/api/grades'),
          api.get('/api/groups'),
          api.get('/api/webinars'),
          api.get('/api/schedule'),
          currentUser.role === 'teacher' || currentUser.role === 'admin'
            ? api.get('/api/enrollments')
            : Promise.resolve(null),
          currentUser.role === 'admin' ? api.get('/api/analytics/overview') : Promise.resolve(null),
          api.get('/api/auth/directory'),
          api.get('/api/messages/inbox'),
          api.get('/api/messages/sent'),
          api.get('/api/messages/unread'),
        ]);
      if (isCancelled) return;

      const apply = (result, setter) => {
        if (result.status === 'fulfilled' && Array.isArray(result.value)) setter(result.value);
      };
      apply(catalog, setCourses);
      apply(assignmentsRes, setAssignments);
      apply(gradesRes, setGrades);
      apply(groupsRes, setAcademicGroups);
      apply(webinarsRes, setWebinars);
      apply(scheduleRes, setSchedule);
      apply(enrollmentsRes, setAllEnrollments);
      if (analyticsRes.status === 'fulfilled' && analyticsRes.value) {
        setAnalytics(analyticsRes.value);
      }
      apply(directoryRes, setDirectory);
      apply(inboxRes, setInboxMessages);
      apply(sentRes, setSentMessages);
      if (unreadRes.status === 'fulfilled' && unreadRes.value) {
        setUnreadMessages(Number(unreadRes.value.unread) || 0);
      }
    };

    load();
    return () => {
      isCancelled = true;
    };
  }, [currentUser]);

  // Real-time webinar events across devices (SSE through the API Gateway).
  // BroadcastChannel ниже остаётся как fallback для вкладок одного браузера.
  useEffect(() => {
    if (!currentUser) return undefined;

    const controller = new AbortController();
    let stopped = false;

    const applyEvent = (event) => {
      if (!event || event.type === 'ping') return;

      if (event.type === 'chat' && event.webinarId && event.message) {
        setWebinars((prev) =>
          prev.map((w) => {
            if (w.id !== event.webinarId) return w;
            const chat = w.chat || [];
            // Оптимистично добавленное сообщение уже есть — не дублируем.
            if (event.message.id && chat.some((m) => m.id === event.message.id)) return w;
            return { ...w, chat: [...chat, event.message] };
          })
        );
        return;
      }

      if (event.type === 'status' && event.webinarId) {
        setWebinars((prev) => prev.map((w) => (w.id === event.webinarId ? { ...w, status: event.status } : w)));
        return;
      }

      if (event.type === 'webinar' && event.webinar?.id) {
        setWebinars((prev) =>
          prev.some((w) => w.id === event.webinar.id)
            ? prev.map((w) => (w.id === event.webinar.id ? { ...w, ...event.webinar } : w))
            : [event.webinar, ...prev]
        );
        return;
      }

      if (event.type === 'deleted' && event.webinarId) {
        setWebinars((prev) => prev.filter((w) => w.id !== event.webinarId));
      }
    };

    const connect = async () => {
      try {
        const response = await fetch('/api/webinars/stream', {
          headers: {
            Accept: 'text/event-stream',
            Authorization: `Bearer ${getToken() || ''}`,
          },
          signal: controller.signal,
        });
        if (!response.ok || !response.body) return;

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (!stopped) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const chunks = buffer.split('\n\n');
          buffer = chunks.pop() || '';

          for (const chunk of chunks) {
            const data = chunk
              .split('\n')
              .filter((line) => line.startsWith('data:'))
              .map((line) => line.slice(5).trim())
              .join('\n');
            if (!data) continue;
            try {
              applyEvent(JSON.parse(data));
            } catch {
              /* игнорируем некорректный кадр */
            }
          }
        }
      } catch {
        /* сервер недоступен или соединение закрыто — работаем без live-обновлений */
      }
    };

    connect();
    return () => {
      stopped = true;
      controller.abort();
    };
  }, [currentUser]);

  // Real-time synchronization across multiple browser tabs/windows (e.g. Teacher in Tab 1, Student in Tab 2)
  useEffect(() => {
    let bc;
    try {
      bc = new BroadcastChannel('studevo_live_webinar_bus');
      bc.onmessage = (event) => {
        const { type, payload } = event.data || {};
        if (type === 'WEBINAR_UPDATE') {
          setWebinars(payload);
        } else if (type === 'CHAT_MESSAGE') {
          setWebinars((prev) =>
            prev.map((w) => (w.id === payload.webinarId ? { ...w, chat: [...(w.chat || []), payload.message] } : w))
          );
        } else if (type === 'STATUS_CHANGE') {
          setWebinars((prev) =>
            prev.map((w) => (w.id === payload.webinarId ? { ...w, status: payload.newStatus } : w))
          );
        }
      };
    } catch {
      // Fallback for environments without BroadcastChannel
    }

    return () => {
      if (bc) bc.close();
    };
  }, []);

  // Оголошення: підвантажуємо після входу та коли відома група студента.
  useEffect(() => {
    if (!currentUser) return undefined;
    let cancelled = false;
    const groupId = academicGroups.find((group) =>
      (group.enrolledUserIds || []).includes(currentUser.id)
    )?.id;
    const query = groupId ? `?groupId=${encodeURIComponent(groupId)}` : '';

    api
      .get(`/api/announcements${query}`)
      .then((list) => {
        if (!cancelled && Array.isArray(list)) setAnnouncements(list);
      })
      .catch(() => {
        /* сервис недоступен */
      });

    return () => {
      cancelled = true;
    };
  }, [currentUser, academicGroups]);

  // Серверный журнал аудита и справочник пользователей (админские экраны)
  const [serverAuditLogs, setServerAuditLogs] = useState([]);
  const [auditStats, setAuditStats] = useState(null);
  const [systemUsers, setSystemUsers] = useState([]);
  const [newUserForm, setNewUserForm] = useState({
    fullName: '',
    email: '',
    username: '',
    password: '123456',
    role: 'STUDENT',
  });
  const [profileForm, setProfileForm] = useState(null);
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', repeat: '' });
  const [editingUser, setEditingUser] = useState(null);
  const [editUserForm, setEditUserForm] = useState({
    fullName: '',
    email: '',
    username: '',
    department: '',
    role: 'STUDENT',
    status: 'ACTIVE',
    password: '',
  });

  const profileValues = profileForm || {
    fullName: currentUser?.name || '',
    email: currentUser?.email || '',
    username: currentUser?.username || '',
    department: currentUser?.dept || '',
  };

  const [enrollUserId, setEnrollUserId] = useState('');
  const [enrollName, setEnrollName] = useState('');

  useEffect(() => {
    if (!currentUser || userRole !== 'admin') return undefined;
    let cancelled = false;

    const load = async () => {
      if (activeMenu === 'audit') {
        try {
          const [logs, stats] = await Promise.all([
            api.get('/api/audit/logs?limit=200'),
            api.get('/api/audit/stats'),
          ]);
          if (cancelled) return;
          const items = Array.isArray(logs?.items) ? logs.items : [];
          setServerAuditLogs(
            items.map((item) => ({
              id: item.id,
              userId: item.userName
                ? `${item.userName}${item.userRole ? ` (${item.userRole})` : ''}`
                : item.userId,
              ip: item.ip,
              action: item.action,
              resource: item.resource,
              status: item.status,
              statusCode: item.statusCode,
              time: new Date(item.time).toLocaleString('uk-UA', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              }),
            })),
          );
          setAuditStats(stats || null);
        } catch {
          /* audit-service недоступен — остаётся локальный журнал */
        }
      }

      if (activeMenu === 'audit' || activeMenu === 'groups') {
        try {
          const users = await api.get('/api/auth/users');
          if (!cancelled && Array.isArray(users)) setSystemUsers(users);
        } catch {
          /* сервис аутентификации недоступен */
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [currentUser, userRole, activeMenu]);

  // UI & Filter States
  const [notification, setNotification] = useState(null);
  const [auditSearch, setAuditSearch] = useState('');

  // Course Modal & Lesson Viewer/Editor States
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [activeLessonId, setActiveLessonId] = useState(null);
  const [newModuleTitle, setNewModuleTitle] = useState('');
  const [newLessonForm, setNewLessonForm] = useState({
    moduleId: '',
    title: '',
    type: 'Лекція',
    content: '',
    linkUrl: '',
    videoUrl: '',
    file: null,
  });
  const [editingLesson, setEditingLesson] = useState(null);

  // Group Management Modal State (Admin)
  const [managingGroupId, setManagingGroupId] = useState(null);
  const [newStudentNameInGroup, setNewStudentNameInGroup] = useState('');

  // Calendar State
  const [calendarDate, setCalendarDate] = useState(new Date(2026, 9, 1));
  const [selectedCalDay, setSelectedCalDay] = useState(null);

  // Forms: Create Group (Admin)
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupFaculty, setNewGroupFaculty] = useState('ФІОТ');
  const [newGroupYear, setNewGroupYear] = useState(4);

  // Forms: Create Course (Teacher)
  const [newCourse, setNewCourse] = useState({
    title: '',
    description: '',
    semester: 7,
    totalHours: 90,
    cover: '/course-coding.jpg',
  });

  // Forms: Create Assignment (Teacher)
  const [newAssignment, setNewAssignment] = useState({
    courseId: 'c-1',
    title: '',
    description: '',
    type: 'Лабораторна',
    maxScore: 100,
    openAt: '',
    deadline: getDefaultDeadline(),
    allowedFormats: 'pdf, docx',
    rubricTitle: 'Критерії оцінювання роботи',
    crit1Name: 'Архітектура та якість коду',
    crit1Max: 40,
    crit2Name: 'Повнота реалізації завдання',
    crit2Max: 35,
    crit3Name: 'Тестування та оформлення звіту',
    crit3Max: 25,
  });

  // Forms: Student Submission
  const [submissionForm, setSubmissionForm] = useState({
    assignmentId: 'asg-2',
    comment: 'Виконано згідно з методичними вказівками. Посилання на репозиторій додано.',
    fileName: '',
    fileSize: '',
    file: null,
  });

  // Teacher Grading States
  const allSubmissionsList = useMemo(() => {
    return assignments.flatMap((asg) =>
      (asg.submissions || []).map((sub) => ({
        ...sub,
        assignmentId: asg.id,
        assignmentTitle: asg.title,
        courseTitle: asg.courseTitle,
        maxScore: asg.maxScore,
        criteria: asg.criteria || [
          { id: 'clean_arch', name: 'Критерій 1', max: 35 },
          { id: 'patterns', name: 'Критерій 2', max: 35 },
          { id: 'tests', name: 'Критерій 3', max: 30 },
        ],
      }))
    );
  }, [assignments]);

  const [selectedSubmissionId, setSelectedSubmissionId] = useState('sub-1');
  const currentGradingSub = useMemo(() => {
    return allSubmissionsList.find((s) => s.id === selectedSubmissionId) || allSubmissionsList[0] || null;
  }, [allSubmissionsList, selectedSubmissionId]);

  const [grading, setGrading] = useState({
    rule: 'AUTO',
    criteriaScores: {
      clean_arch: 32,
      patterns: 34,
      tests: 28,
    },
    feedback: 'Завдання виконано якісно, всі вимоги робочої програми дотримано.',
  });
  const [gradingResult, setGradingResult] = useState(null);

  const [newWebinarForm, setNewWebinarForm] = useState({
    courseId: 'c-1',
    title: '',
    scheduledAt: getDefaultWebinarDate(),
    meetingUrl: '',
  });

  const selectedCourse = useMemo(
    () => courses.find((c) => c.id === selectedCourseId) || null,
    [courses, selectedCourseId]
  );

  const managingGroup = useMemo(
    () => academicGroups.find((g) => g.id === managingGroupId) || null,
    [academicGroups, managingGroupId]
  );

  const showNotification = (text, isError = false) => {
    setNotification({ text, isError });
  };

  const appendAuditLog = (action, resource, status = 'ALLOWED', customUser = null) => {
    const nowStr = new Date().toLocaleString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const actor = customUser || (currentUser ? currentUser.name : 'Користувач');
    const newEntry = {
      id: newId('log'),
      userId: actor,
      ip: '192.168.1.45',
      action,
      resource,
      status,
      time: nowStr,
    };
    setAuditLogs((prev) => [newEntry, ...prev]);
  };

  const appendEvent = (type, title, desc) => {
    const ev = {
      id: newId('ev'),
      type,
      title,
      desc,
      time: 'Щойно',
    };
    setEventsFeed((prev) => [ev, ...prev.slice(0, 7)]);
  };

  /**
   * Единая точка записи в backend. Возвращает данные либо null.
   * Любая ошибка (сеть, 4xx, 5xx) показывается пользователю — молчаливых
   * «успешных» сохранений больше нет.
   */
  const syncBackend = async (path, method = 'POST', body = null) => {
    try {
      return await request(path.startsWith('/api') ? path : `/api${path}`, { method, body });
    } catch (err) {
      showNotification(err.message || 'Не вдалося зберегти зміни на сервері.', true);
      return null;
    }
  };

  // ========================================================
  // LOGIN: РЕАЛЬНАЯ АУТЕНТИФИКАЦИЯ ЧЕРЕЗ AUTH-SERVICE (JWT)
  // ========================================================
  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setLoginError('');

    if (!loginInput.trim() || !passwordInput) {
      setLoginError('Введіть логін та пароль.');
      return;
    }

    try {
      const loggedIn = await login(loginInput.trim(), passwordInput);
      setActiveMenu('dashboard');
      setNotification(null);
      setLoginInput('');
      setPasswordInput('');
      appendAuditLog('Вхід у систему', loggedIn.dept || 'Кабінет', 'ALLOWED', loggedIn.name);
    } catch (err) {
      setLoginError(err.message || 'Невірний логін або пароль.');
    }
  };

  const handleLogout = () => {
    appendAuditLog('Вихід із системи', currentUser?.dept || 'Кабінет', 'ALLOWED');
    logout();
    setLoginInput('');
    setPasswordInput('');
    setLoginError('');
    setNotification(null);
  };

  // ========================================================
  // 1. COURSES, MODULES & LESSONS
  // ========================================================
  const handleCreateCourse = async (e) => {
    e.preventDefault();
    if (!newCourse.title.trim()) return;
    const courseId = newId('c');
    const created = {
      id: courseId,
      title: newCourse.title.trim(),
      instructor: currentUser?.name || 'Викладач',
      description: newCourse.description.trim(),
      semester: Number(newCourse.semester) || 7,
      modulesCount: 1,
      totalHours: Number(newCourse.totalHours) || 90,
      isPublished: false,
      cover: newCourse.cover || '/course-coding.jpg',
      modules: [
        {
          id: newId('m'),
          title: 'Модуль 1: Вступ та основні поняття курсу',
          lessons: [
            {
              id: newId('l'),
              title: 'Лекція 1: Вступна лекція та робоча програма',
              type: 'Лекція',
              completed: false,
              content: newCourse.description.trim() || 'Матеріали вступної лекції та критерії оцінювання за семестр.',
            },
          ],
        },
      ],
      progress: 0,
    };

    const res = await syncBackend('/catalog', 'POST', {
      title: created.title,
      description: created.description,
      instructor: created.instructor,
      semester: created.semester,
      totalHours: created.totalHours,
      cover: created.cover,
    });
    if (res && res.id) {
      created.id = res.id;
    }

    setCourses((prev) => [created, ...prev]);
    appendAuditLog('Створення нової дисципліни', created.title, 'ALLOWED');
    appendEvent('course', 'Нова дисципліна', `«${created.title}» (${created.totalHours} год.) додано до каталогу.`);
    showNotification(`Дисципліну «${created.title}» створено.`);
    setNewCourse({ title: '', description: '', semester: 7, totalHours: 90, cover: '/course-coding.jpg' });
  };

  const handlePublishCourse = async (courseId) => {
    await syncBackend(`/courses/${courseId}/publish`, 'POST');
    const target = courses.find((c) => c.id === courseId);
    setCourses((prev) =>
      prev.map((c) => (c.id === courseId ? { ...c, isPublished: true } : c))
    );
    if (target) {
      appendAuditLog('Публікація курсу для студентів', target.title, 'ALLOWED');
      appendEvent('course', 'Опубліковано курс', `Дисципліна «${target.title}» відкрита для студентів.`);
    }
    showNotification('Дисципліну опубліковано для студентів.');
  };

  const handleToggleLessonCompleted = async (courseId, lessonId) => {
    if (!currentUser?.id) return;
    await syncBackend(`/catalog/lessons/${lessonId}/toggle`, 'POST', {
      userId: currentUser.id,
    });
    setCourses((prev) =>
      prev.map((c) => {
        if (c.id !== courseId) return c;
        const updatedModules = c.modules.map((m) => ({
          ...m,
          lessons: m.lessons.map((l) =>
            l.id === lessonId ? { ...l, completed: !l.completed } : l
          ),
        }));
        const newProgress = calcCourseProgress(updatedModules);
        return {
          ...c,
          modules: updatedModules,
          progress: newProgress,
        };
      })
    );
    showNotification('Прогрес вивчення матеріалу оновлено.');
  };

  const handleAddModuleToCourse = async (e) => {
    e.preventDefault();
    if (!selectedCourse || !newModuleTitle.trim()) return;
    const res = await syncBackend(`/catalog/${selectedCourse.id}/modules`, 'POST', {
      title: newModuleTitle.trim(),
    });
    const newModId = res?.id || `m-${Date.now()}`;

    setCourses((prev) =>
      prev.map((c) => {
        if (c.id !== selectedCourse.id) return c;
        const updatedModules = [
          ...(c.modules || []),
          { id: newModId, title: newModuleTitle.trim(), lessons: [] },
        ];
        return {
          ...c,
          modules: updatedModules,
          modulesCount: updatedModules.length,
          progress: calcCourseProgress(updatedModules),
        };
      })
    );
    setNewModuleTitle('');
    setNewLessonForm((prev) => ({ ...prev, moduleId: newModId }));
    showNotification('Новий змістовий модуль додано.');
  };

  const handleAddLessonToModule = async (e) => {
    e.preventDefault();
    if (!selectedCourse || !newLessonForm.title.trim()) return;
    const targetModId = newLessonForm.moduleId || selectedCourse.modules?.[0]?.id;
    if (!targetModId) {
      showNotification('Спочатку додайте змістовий модуль.', true);
      return;
    }

    let res;
    if (newLessonForm.file) {
      const formData = new FormData();
      formData.append('title', newLessonForm.title.trim());
      formData.append('type', newLessonForm.type);
      if (newLessonForm.content.trim()) formData.append('content', newLessonForm.content.trim());
      if (newLessonForm.linkUrl.trim()) formData.append('linkUrl', newLessonForm.linkUrl.trim());
      if (newLessonForm.videoUrl.trim()) formData.append('videoUrl', newLessonForm.videoUrl.trim());
      formData.append('file', newLessonForm.file);
      res = await syncBackend(`/catalog/modules/${targetModId}/lessons-file`, 'POST', formData);
    } else {
      res = await syncBackend(`/catalog/modules/${targetModId}/lessons`, 'POST', {
        title: newLessonForm.title.trim(),
        type: newLessonForm.type,
        content: newLessonForm.content.trim(),
        linkUrl: newLessonForm.linkUrl.trim(),
        videoUrl: newLessonForm.videoUrl.trim(),
      });
    }
    if (!res) return;

    const newLesson = {
      id: res.id,
      title: res.title || newLessonForm.title.trim(),
      type: res.type || newLessonForm.type,
      completed: false,
      content:
        res.content ||
        newLessonForm.content.trim() ||
        'Навчальний матеріал для самостійного опрацювання та підготовки до практичних робіт.',
      linkUrl: res.linkUrl || '',
      videoUrl: res.videoUrl || '',
      fileName: res.fileName || '',
      fileSize: res.fileSize || '',
      hasFile: Boolean(res.hasFile),
      downloadUrl: res.downloadUrl || null,
    };

    setCourses((prev) =>
      prev.map((c) => {
        if (c.id !== selectedCourse.id) return c;
        const updatedModules = c.modules.map((m) =>
          m.id === targetModId ? { ...m, lessons: [...m.lessons, newLesson] } : m
        );
        return {
          ...c,
          modules: updatedModules,
          progress: calcCourseProgress(updatedModules),
        };
      })
    );

    setActiveLessonId(newLesson.id);
    setNewLessonForm((prev) => ({
      ...prev,
      title: '',
      content: '',
      linkUrl: '',
      videoUrl: '',
      file: null,
    }));
    showNotification(`Матеріал «${newLesson.title}» додано до курсу.`);
  };

  const handleUpdateLesson = async (e) => {
    e.preventDefault();
    if (!editingLesson || !selectedCourse) return;

    let res;
    if (editingLesson.file) {
      const formData = new FormData();
      formData.append('title', editingLesson.title);
      formData.append('type', editingLesson.type);
      formData.append('content', editingLesson.content || '');
      formData.append('linkUrl', editingLesson.linkUrl || '');
      formData.append('videoUrl', editingLesson.videoUrl || '');
      formData.append('file', editingLesson.file);
      res = await syncBackend(`/catalog/lessons/${editingLesson.id}/file`, 'PATCH', formData);
    } else {
      res = await syncBackend(`/catalog/lessons/${editingLesson.id}`, 'PATCH', {
        title: editingLesson.title,
        type: editingLesson.type,
        content: editingLesson.content || '',
        linkUrl: editingLesson.linkUrl || '',
        videoUrl: editingLesson.videoUrl || '',
      });
    }
    if (!res) return;

    setCourses((prev) =>
      prev.map((course) => {
        if (course.id !== selectedCourse.id) return course;
        return {
          ...course,
          modules: course.modules.map((mod) => ({
            ...mod,
            lessons: mod.lessons.map((lesson) =>
              lesson.id === editingLesson.id ? { ...lesson, ...res } : lesson
            ),
          })),
        };
      })
    );
    setEditingLesson(null);
    showNotification('Матеріал оновлено.');
  };

  // ========================================================
  // 2. ASSIGNMENTS & SUBMISSIONS
  // ========================================================
  const handleCreateAssignment = async (e) => {
    e.preventDefault();
    if (!newAssignment.title.trim()) return;
    const targetCourse = courses.find((c) => c.id === newAssignment.courseId) || courses[0];
    const c1Max = Number(newAssignment.crit1Max) || 40;
    const c2Max = Number(newAssignment.crit2Max) || 35;
    const c3Max = Number(newAssignment.crit3Max) || 25;
    const totalMax = c1Max + c2Max + c3Max;

    const createdAsg = {
      id: newId('asg'),
      courseId: targetCourse.id,
      courseTitle: targetCourse.title,
      title: newAssignment.title.trim(),
      description: newAssignment.description.trim() || 'Виконати завдання згідно з вимогами курсу.',
      type: newAssignment.type,
      openAt: newAssignment.openAt ? new Date(newAssignment.openAt).toISOString() : undefined,
      deadline: new Date(newAssignment.deadline).toISOString(),
      allowedFormats: newAssignment.allowedFormats
        .split(',')
        .map((format) => format.trim().toLowerCase())
        .filter(Boolean),
      maxScore: totalMax,
      rubricTitle: `Критерії оцінювання (${totalMax} балів)`,
      criteria: [
        { id: 'clean_arch', name: newAssignment.crit1Name || 'Критерій 1', max: c1Max },
        { id: 'patterns', name: newAssignment.crit2Name || 'Критерій 2', max: c2Max },
        { id: 'tests', name: newAssignment.crit3Name || 'Критерій 3', max: c3Max },
      ],
      submissions: [],
    };

    const res = await syncBackend('/assignments-full', 'POST', createdAsg);
    if (res && res.id) {
      createdAsg.id = res.id;
    }

    setAssignments((prev) => [createdAsg, ...prev]);
    setSubmissionForm((prev) => ({ ...prev, assignmentId: createdAsg.id }));
    appendAuditLog('Створення нового завдання', createdAsg.title, 'ALLOWED');
    appendEvent('course', 'Нове завдання', `«${createdAsg.title}» (${createdAsg.courseTitle})`);
    showNotification(`Завдання «${createdAsg.title}» успішно опубліковано.`);
    setNewAssignment((prev) => ({ ...prev, title: '', description: '', deadline: getDefaultDeadline() }));
  };

  const formatBytes = (bytes) => {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} МБ`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
    return `${bytes} Б`;
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      showNotification('Файл перевищує 25 МБ. Оберіть менший файл.', true);
      e.target.value = '';
      return;
    }
    setSubmissionForm((prev) => ({
      ...prev,
      file,
      fileName: file.name,
      fileSize: formatBytes(file.size),
    }));
  };

  const handleStudentSubmit = async (e) => {
    e.preventDefault();
    const targetAsg = assignments.find((a) => a.id === submissionForm.assignmentId) || assignments[0];
    if (!targetAsg) return;

    const file = submissionForm.file;
    const comment = submissionForm.comment.trim();
    if (!file && !comment) {
      showNotification('Додайте файл звіту або коментар із посиланням на репозиторій.', true);
      return;
    }

    let res;
    if (file) {
      const formData = new FormData();
      formData.append('file', file);
      if (comment) formData.append('comment', comment);
      res = await syncBackend(`/assignments/${targetAsg.id}/submit-file`, 'POST', formData);
    } else {
      res = await syncBackend(`/assignments/${targetAsg.id}/submit`, 'POST', { comment });
    }

    if (!res || !res.id) return; // ошибка уже показана пользователю

    setAssignments((prev) =>
      prev.map((a) => {
        if (a.id !== targetAsg.id) return a;
        const filtered = (a.submissions || []).filter((s) => s.studentId !== res.studentId);
        return { ...a, submissions: [res, ...filtered] };
      })
    );

    setSelectedSubmissionId(res.id);
    setSubmissionForm((prev) => ({ ...prev, file: null, fileName: '', fileSize: '' }));
    appendAuditLog('Здача роботи на перевірку', targetAsg.title, 'ALLOWED');
    appendEvent('course', 'Здано роботу', `${res.studentName}: «${res.fileName || 'без файлу'}»`);
    showNotification(
      res.isLate
        ? 'Роботу надіслано після дедлайну — під час оцінювання буде застосовано штраф 20%.'
        : `Роботу «${res.fileName || 'без файлу'}» надіслано викладачу на перевірку.`,
      Boolean(res.isLate),
    );
  };

  const handleDownloadLesson = async (lesson) => {
    try {
      const blob = await requestBlob(`/api/catalog/lessons/${lesson.id}/file`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = lesson.fileName || 'material';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      showNotification(err.message || 'Не вдалося завантажити матеріал.', true);
    }
  };

  const handleDownloadSubmission = async (sub) => {
    if (!sub?.hasFile) {
      showNotification('До цієї роботи не прикріплено файл.', true);
      return;
    }
    try {
      const blob = await requestBlob(`/api/submissions/${sub.id}/file`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = sub.fileName || 'submission';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      showNotification(err.message || 'Не вдалося завантажити файл.', true);
    }
  };

  // ========================================================
  // 3. GRADING & GRADEBOOK
  // ========================================================
  const handleSelectSubmissionForGrading = (subId) => {
    setSelectedSubmissionId(subId);
    const found = allSubmissionsList.find((s) => s.id === subId);
    if (found && found.criteria) {
      const nextScores = {};
      found.criteria.forEach((c) => {
        nextScores[c.id] = Math.round(c.max * 0.9);
      });
      setGrading((prev) => ({
        ...prev,
        criteriaScores: nextScores,
      }));
    }
  };

  const liveRawScore = useMemo(() => {
    return Object.values(grading.criteriaScores).reduce((acc, val) => acc + (Number(val) || 0), 0);
  }, [grading.criteriaScores]);

  // AUTO = штраф за просрочку применяется сервером автоматически.
  const effectiveRule = useMemo(() => {
    if (grading.rule !== 'AUTO') return grading.rule;
    return currentGradingSub?.isLate ? 'LATE_PENALTY' : 'STANDARD';
  }, [grading.rule, currentGradingSub]);

  const liveFinalScore = useMemo(() => {
    const maxPossible = currentGradingSub?.maxScore || 100;
    if (effectiveRule === 'LATE_PENALTY') {
      return Math.round(liveRawScore * 0.8 * 10) / 10;
    }
    if (effectiveRule === 'EXCELLENCE_BONUS') {
      return liveRawScore >= 90 ? Math.min(maxPossible, liveRawScore + 5) : liveRawScore;
    }
    return Math.min(maxPossible, liveRawScore);
  }, [liveRawScore, effectiveRule, currentGradingSub]);

  const handleGradeWithStrategy = async (e) => {
    e.preventDefault();
    const targetSub = currentGradingSub;
    if (!targetSub) {
      showNotification('Оберіть роботу для оцінювання.', true);
      return;
    }
    const studentName = targetSub.studentName;
    const courseTitle = targetSub.courseTitle;
    const assignmentTitle = targetSub.assignmentTitle;
    const maxScore = targetSub.maxScore;

    let ruleDesc = 'Стандартний розрахунок';
    if (effectiveRule === 'LATE_PENALTY') {
      ruleDesc = targetSub?.isLate ? 'Зниження на 20% (пізня здача)' : 'Зниження на 20% (за рішенням викладача)';
    } else if (effectiveRule === 'EXCELLENCE_BONUS') {
      ruleDesc = 'Заохочувальний бонус (+5 балів)';
    }

    const resultObj = {
      id: newId('grd'),
      assignmentId: targetSub.assignmentId,
      submissionId: targetSub.id,
      studentId: targetSub.studentId,
      studentName,
      group: targetSub.group,
      courseTitle,
      assignmentTitle,
      submittedAt: new Date().toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' }),
      rawScore: liveRawScore,
      finalScore: liveFinalScore,
      maxScore,
      rule: effectiveRule,
      ruleDesc,
      isLate: Boolean(targetSub?.isLate),
      feedback: grading.feedback,
    };

    const res = await syncBackend('/grading/grade', 'POST', {
      submissionId: targetSub?.id || 'sub-1',
      rule: grading.rule === 'AUTO' ? undefined : grading.rule,
      criteriaScores: grading.criteriaScores,
      feedback: grading.feedback,
    });
    if (res && res.finalScore !== undefined) {
      resultObj.finalScore = res.finalScore;
      if (res.id) resultObj.id = res.id;
    }

    setGradingResult(resultObj);

    setGrades((prev) => {
      const withoutDuplicate = prev.filter((g) => g.submissionId !== resultObj.submissionId);
      return [resultObj, ...withoutDuplicate];
    });

    if (targetSub) {
      setAssignments((prev) =>
        prev.map((asg) => {
          if (asg.id !== targetSub.assignmentId) return asg;
          return {
            ...asg,
            submissions: (asg.submissions || []).map((s) =>
              s.id === targetSub.id ? { ...s, status: 'GRADED', score: liveFinalScore } : s
            ),
          };
        })
      );
    }

    appendAuditLog(`Виставлення оцінки (${liveFinalScore}/${maxScore})`, assignmentTitle, 'ALLOWED');
    appendEvent(
      'grade',
      `Виставлено ${liveFinalScore}/${maxScore} (ECTS: ${getEctsLetter(liveFinalScore)})`,
      `${studentName} — «${assignmentTitle}»`
    );
    showNotification(`Оцінку ${liveFinalScore}/${maxScore} (ECTS: ${getEctsLetter(liveFinalScore)}) збережено в журналі.`);
  };

  const handleExportGradesCsv = () => {
    const headers = ['Студент', 'Група', 'Дисципліна', 'Завдання', 'Дата', 'Бал', 'Макс', 'ECTS', 'Примітка', 'Коментар'];
    const rows = grades.map((g) => [
      `"${g.studentName}"`,
      `"${g.group}"`,
      `"${g.courseTitle}"`,
      `"${g.assignmentTitle}"`,
      `"${g.submittedAt}"`,
      g.finalScore,
      g.maxScore,
      getEctsLetter(g.finalScore),
      `"${g.ruleDesc}"`,
      `"${(g.feedback || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Відомість_Studevo_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification('Відомість успішно завантажено у форматі CSV.');
  };

  // ========================================================
  const handleScheduleWebinar = async (e) => {
    e.preventDefault();
    if (!newWebinarForm.title.trim()) return;
    const targetCourse = courses.find((c) => c.id === newWebinarForm.courseId) || courses[0];
    const createdWeb = {
      id: newId('web'),
      courseId: targetCourse.id,
      courseTitle: targetCourse.title,
      title: newWebinarForm.title.trim(),
      instructor: currentUser?.name || 'Викладач',
      scheduledAt: new Date(newWebinarForm.scheduledAt).toISOString(),
      status: 'SCHEDULED',
      meetingUrl: newWebinarForm.meetingUrl?.trim() || '',
      chat: [
        {
          id: newId('msg'),
          senderName: currentUser?.name || 'Викладач',
          senderRole: userRole,
          text: `Онлайн-заняття «${newWebinarForm.title.trim()}» додано до розкладу.`,
          time: new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }),
        },
      ],
    };

    const res = await syncBackend('/webinars', 'POST', {
      courseId: targetCourse.id,
      title: createdWeb.title,
      scheduledAt: createdWeb.scheduledAt,
      instructor: createdWeb.instructor,
      senderRole: userRole,
      meetingUrl: createdWeb.meetingUrl,
    });
    if (res && res.id) {
      createdWeb.id = res.id;
    }

    setWebinars((prev) => {
      const updated = [createdWeb, ...prev];
      try {
        const bc = new BroadcastChannel('studevo_live_webinar_bus');
        bc.postMessage({ type: 'WEBINAR_UPDATE', payload: updated });
        bc.close();
      } catch {
        /* BroadcastChannel недоступен в этом окружении */
      }
      return updated;
    });
    setNewWebinarForm((prev) => ({ ...prev, title: '', scheduledAt: getDefaultWebinarDate() }));
    appendEvent('course', 'Заплановано онлайн-заняття', `«${createdWeb.title}» (${createdWeb.courseTitle})`);
    showNotification(`Онлайн-заняття «${createdWeb.title}» додано до розкладу.`);
  };

  const handleUpdateWebinarMeeting = async (webinarId, meetingUrl) => {
    const res = await syncBackend(`/webinars/${webinarId}/meeting`, 'PATCH', { meetingUrl });
    if (!res) return;
    setWebinars((prev) =>
      prev.map((webinar) =>
        webinar.id === webinarId ? { ...webinar, meetingUrl: res.meetingUrl } : webinar
      )
    );
    showNotification('Посилання на конференцію оновлено.');
  };

  const handleDeleteWebinar = async (webinarId) => {
    if (!window.confirm('Видалити це онлайн-заняття з розкладу?')) return;
    await syncBackend(`/webinars/${webinarId}`, 'DELETE');
    setWebinars((prev) => {
      const updated = prev.filter((w) => w.id !== webinarId);
      try {
        const bc = new BroadcastChannel('studevo_live_webinar_bus');
        bc.postMessage({ type: 'WEBINAR_UPDATE', payload: updated });
        bc.close();
      } catch {
        /* BroadcastChannel недоступен в этом окружении */
      }
      return updated;
    });
    showNotification('Онлайн-заняття видалено з розкладу.');
  };

  const handleChangeWebinarStatus = async (webinarId, newStatus) => {
    await syncBackend(`/webinars/${webinarId}/status`, 'PATCH', { status: newStatus });
    setWebinars((prev) =>
      prev.map((w) => (w.id === webinarId ? { ...w, status: newStatus } : w))
    );
    try {
      const bc = new BroadcastChannel('studevo_live_webinar_bus');
      bc.postMessage({ type: 'STATUS_CHANGE', payload: { webinarId, newStatus } });
      bc.close();
    } catch {
      /* BroadcastChannel недоступен в этом окружении */
    }
    showNotification(newStatus === 'LIVE' ? 'Прямий ефір розпочато!' : 'Трансляцію завершено.');
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    const group = {
      id: newId('g'),
      name: newGroupName.trim(),
      faculty: newGroupFaculty.trim(),
      studyYear: Number(newGroupYear),
      studentsCount: 0,
      assignedCourseIds: [],
      studentsList: [],
    };

    const res = await syncBackend('/groups', 'POST', group);
    if (res && res.id) {
      group.id = res.id;
    }

    setAcademicGroups((prev) => [group, ...prev]);
    appendAuditLog('Створення академічної групи', group.name, 'ALLOWED');
    showNotification(`Академічну групу «${group.name}» зареєстровано.`);
    setNewGroupName('');
  };

  const handleToggleCourseForGroup = async (groupId, courseId) => {
    await syncBackend(`/groups/${groupId}/toggle-course`, 'POST', { courseId });
    setAcademicGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        const exists = (g.assignedCourseIds || []).includes(courseId);
        const nextIds = exists
          ? g.assignedCourseIds.filter((id) => id !== courseId)
          : [...(g.assignedCourseIds || []), courseId];
        return { ...g, assignedCourseIds: nextIds };
      })
    );
    showNotification('Навчальний план групи оновлено.');
  };

  const handleAddStudentToGroup = async (e) => {
    e.preventDefault();
    if (!managingGroup || !newStudentNameInGroup.trim()) return;
    await syncBackend(`/groups/${managingGroup.id}/students`, 'POST', {
      studentName: newStudentNameInGroup.trim(),
    });
    setAcademicGroups((prev) =>
      prev.map((g) => {
        if (g.id !== managingGroup.id) return g;
        const updatedList = [...(g.studentsList || []), newStudentNameInGroup.trim()];
        return {
          ...g,
          studentsList: updatedList,
          studentsCount: (g.studentsCount || 0) + 1,
        };
      })
    );
    showNotification(`Студента «${newStudentNameInGroup.trim()}» додано до групи ${managingGroup.name}.`);
    setNewStudentNameInGroup('');
  };

  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    if (!announcementForm.title.trim() || !announcementForm.body.trim()) return;

    const res = await syncBackend('/announcements', 'POST', {
      title: announcementForm.title.trim(),
      body: announcementForm.body.trim(),
      audience: announcementForm.audience,
      groupId: announcementForm.audience === 'GROUP' ? announcementForm.groupId : undefined,
    });
    if (!res) return;

    setAnnouncements((prev) => [res, ...prev]);
    setAnnouncementForm({ title: '', body: '', audience: 'ALL', groupId: '' });
    showNotification('Оголошення опубліковано.');
  };

  const handleDeleteAnnouncement = async (id) => {
    const res = await syncBackend(`/announcements/${id}`, 'DELETE');
    if (!res) return;
    setAnnouncements((prev) => prev.filter((item) => item.id !== id));
    showNotification('Оголошення видалено.');
  };

  const handleCreateSchedule = async (e) => {
    e.preventDefault();
    if (!scheduleForm.courseId || !scheduleForm.groupId) {
      showNotification('Оберіть дисципліну та групу.', true);
      return;
    }

    const res = await syncBackend('/schedule', 'POST', {
      ...scheduleForm,
      weekday: Number(scheduleForm.weekday),
    });
    if (!res) return;

    setSchedule((prev) =>
      [...prev, res].sort(
        (a, b) => Number(a.weekday) - Number(b.weekday) || a.startTime.localeCompare(b.startTime)
      )
    );
    setScheduleForm((prev) => ({ ...prev, room: '', onlineUrl: '' }));
    showNotification('Пару додано до розкладу.');
  };

  const handleDeleteSchedule = async (id) => {
    const res = await syncBackend(`/schedule/${id}`, 'DELETE');
    if (!res) return;
    setSchedule((prev) => prev.filter((entry) => entry.id !== id));
    showNotification('Пару видалено з розкладу.');
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const recipient = directory.find((user) => user.id === composeForm.recipientId);
    if (!recipient || !composeForm.body.trim()) {
      showNotification('Оберіть отримувача та введіть текст повідомлення.', true);
      return;
    }

    const res = await syncBackend('/messages', 'POST', {
      recipientId: recipient.id,
      recipientName: recipient.fullName,
      subject: composeForm.subject.trim(),
      body: composeForm.body.trim(),
    });
    if (!res) return;

    setSentMessages((prev) => [res, ...prev]);
    if (messagePeer?.id === recipient.id) {
      setThreadMessages((prev) => [...prev, res]);
    }
    setComposeForm({ recipientId: '', subject: '', body: '' });
    showNotification('Повідомлення надіслано.');
  };

  const handleOpenThread = async (peer) => {
    setMessagePeer(peer);
    setReplyBody('');
    setThreadLoading(true);
    try {
      const res = await api.get(`/api/messages/thread/${encodeURIComponent(peer.id)}`);
      const messages = Array.isArray(res) ? res : [];
      setThreadMessages(messages);

      const unreadInThread = messages.filter(
        (message) => message.recipientId === currentUser?.id && !message.readAt
      );
      if (unreadInThread.length > 0) {
        await api.patch(`/api/messages/thread/${encodeURIComponent(peer.id)}/read`);
        const unreadIds = new Set(unreadInThread.map((message) => message.id));
        setInboxMessages((prev) =>
          prev.map((message) =>
            unreadIds.has(message.id)
              ? { ...message, unread: false, readAt: new Date().toISOString() }
              : message
          )
        );
        setUnreadMessages((prev) => Math.max(0, prev - unreadIds.size));
      }
    } catch (err) {
      showNotification(err.message || 'Не вдалося завантажити діалог.', true);
    } finally {
      setThreadLoading(false);
    }
  };

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!messagePeer || !replyBody.trim()) return;

    const res = await syncBackend('/messages', 'POST', {
      recipientId: messagePeer.id,
      recipientName: messagePeer.name,
      subject: '',
      body: replyBody.trim(),
    });
    if (!res) return;

    setThreadMessages((prev) => [...prev, res]);
    setSentMessages((prev) => [res, ...prev]);
    setReplyBody('');
    showNotification('Відповідь надіслано.');
  };

  const handleMarkAllRead = async () => {
    const res = await syncBackend('/messages/read-all', 'PATCH');
    if (!res) return;
    const now = new Date().toISOString();
    setInboxMessages((prev) =>
      prev.map((message) => ({ ...message, unread: false, readAt: message.readAt || now }))
    );
    setThreadMessages((prev) =>
      prev.map((message) => ({ ...message, unread: false, readAt: message.readAt || now }))
    );
    setUnreadMessages(0);
    showNotification('Усі повідомлення позначено прочитаними.');
  };

  const handleAssignCurator = async (groupId, curatorId) => {
    const res = await syncBackend(`/groups/${groupId}/curator`, 'PATCH', {
      curatorId: curatorId || null,
    });
    if (!res) return;
    setAcademicGroups((prev) =>
      prev.map((group) => (group.id === groupId ? { ...group, curatorId: res.curatorId } : group))
    );
    showNotification('Куратора групи оновлено.');
  };

  const handleUserStatus = async (userId, status) => {
    const res = await syncBackend(`/auth/users/${userId}/status`, 'PATCH', { status });
    if (!res) return;
    setSystemUsers((prev) =>
      prev.map((user) => (user.id === userId ? { ...user, status: res.status } : user))
    );
    showNotification('Статус навчання оновлено.');
  };

  const handleAssignTeacher = async (courseId, ownerId) => {
    const res = await syncBackend(`/catalog/${courseId}/owner`, 'PATCH', {
      ownerId: ownerId || null,
    });
    if (!res) return;

    setCourses((prev) =>
      prev.map((course) => (course.id === courseId ? { ...course, ownerId: res.ownerId } : course))
    );
    showNotification('Відповідального викладача оновлено.');
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUserForm.fullName.trim() || !newUserForm.email.trim()) return;

    const res = await syncBackend('/auth/users', 'POST', {
      fullName: newUserForm.fullName.trim(),
      email: newUserForm.email.trim(),
      username: newUserForm.username.trim() || undefined,
      password: newUserForm.password,
      role: newUserForm.role,
    });
    if (!res) return;

    setSystemUsers((prev) => [...prev, res]);
    setNewUserForm({ fullName: '', email: '', username: '', password: '123456', role: 'STUDENT' });
    showNotification(`Користувача «${res.fullName}» створено.`);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    const res = await syncBackend('/auth/me', 'PATCH', {
      fullName: profileValues.fullName.trim(),
      email: profileValues.email.trim(),
      username: profileValues.username.trim(),
      department: profileValues.department.trim(),
    });
    if (!res) return;

    try {
      await refreshProfile();
    } catch {
      /* профиль обновится при следующей загрузке */
    }
    setProfileForm(null);
    setSystemUsers((prev) => prev.map((user) => (user.id === res.id ? res : user)));
    showNotification('Профіль оновлено.');
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.next !== passwordForm.repeat) {
      showNotification('Новий пароль і підтвердження не збігаються.', true);
      return;
    }
    const res = await syncBackend('/auth/change-password', 'POST', {
      currentPassword: passwordForm.current,
      newPassword: passwordForm.next,
    });
    if (!res) return;
    setPasswordForm({ current: '', next: '', repeat: '' });
    showNotification('Пароль успішно змінено.');
  };

  const handleStartEditUser = (user) => {
    setEditingUser(user);
    setEditUserForm({
      fullName: user.fullName || '',
      email: user.email || '',
      username: user.username || '',
      department: user.department || '',
      role: user.role || 'STUDENT',
      status: user.status || 'ACTIVE',
      password: '',
    });
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    if (!editingUser) return;

    const res = await syncBackend(`/auth/users/${editingUser.id}`, 'PATCH', {
      fullName: editUserForm.fullName.trim(),
      email: editUserForm.email.trim(),
      username: editUserForm.username.trim(),
      department: editUserForm.department.trim(),
      role: editUserForm.role,
      status: editUserForm.status,
    });
    if (!res) return;

    if (editUserForm.password.trim()) {
      const passwordRes = await syncBackend(`/auth/users/${editingUser.id}/password`, 'POST', {
        password: editUserForm.password.trim(),
      });
      if (!passwordRes) return;
    }

    setSystemUsers((prev) => prev.map((user) => (user.id === res.id ? res : user)));
    setEditingUser(null);
    showNotification(`Дані користувача «${res.fullName}» оновлено.`);
  };

  const handleTransferUser = async (userId, groupId) => {
    const current = allEnrollments.find((item) => item.userId === userId);

    let res;
    if (!groupId) {
      if (!current) return;
      res = await syncBackend(
        `/groups/${current.groupId}/enroll/${encodeURIComponent(userId)}`,
        'DELETE'
      );
    } else {
      res = await syncBackend(`/groups/${groupId}/enroll`, 'POST', { userId });
    }
    if (!res) return;

    try {
      const [groups, enrollments] = await Promise.all([api.get('/api/groups'), api.get('/api/enrollments')]);
      if (Array.isArray(groups)) setAcademicGroups(groups);
      if (Array.isArray(enrollments)) setAllEnrollments(enrollments);
    } catch {
      /* данные обновятся при следующей загрузке */
    }
    showNotification('Дані зачислення оновлено.');
  };

  const handleEnrollStudent = async (e) => {
    e.preventDefault();
    if (!managingGroup || !enrollUserId.trim()) return;

    const userId = enrollUserId.trim();
    const res = await syncBackend(`/groups/${managingGroup.id}/enroll`, 'POST', {
      userId,
      studentName: enrollName.trim() || undefined,
    });
    if (!res) return;

    const user = systemUsers.find((u) => u.id === userId);
    const displayName = enrollName.trim() || user?.fullName || userId;

    setAcademicGroups((prev) =>
      prev.map((g) => {
        if (g.id !== managingGroup.id) return g;
        const studentsList = (g.studentsList || []).includes(displayName)
          ? g.studentsList
          : [...(g.studentsList || []), displayName];
        const enrolledUserIds = Array.from(new Set([...(g.enrolledUserIds || []), userId]));
        return { ...g, studentsList, studentsCount: studentsList.length, enrolledUserIds };
      })
    );
    showNotification(`Користувача «${displayName}» зараховано до групи ${managingGroup.name}.`);
    setEnrollUserId('');
    setEnrollName('');
  };

  const handleRemoveStudentFromGroup = async (studentName) => {
    if (!managingGroup) return;
    await syncBackend(`/groups/${managingGroup.id}/students/${encodeURIComponent(studentName)}`, 'DELETE');
    setAcademicGroups((prev) =>
      prev.map((g) => {
        if (g.id !== managingGroup.id) return g;
        const updatedList = (g.studentsList || []).filter((s) => s !== studentName);
        return {
          ...g,
          studentsList: updatedList,
          studentsCount: Math.max(0, (g.studentsCount || 1) - 1),
        };
      })
    );
    showNotification(`Студента «${studentName}» вилучено зі складу групи.`);
  };

  // ========================================================
  // COMPUTED METRICS & CALENDAR
  // ========================================================
  const averageStudentGrade = useMemo(() => {
    if (!grades || grades.length === 0) return '0.0';
    const sum = grades.reduce((acc, g) => acc + Number(g.finalScore || 0), 0);
    return (sum / grades.length).toFixed(1);
  }, [grades]);

  const ungradedSubmissions = useMemo(() => {
    return allSubmissionsList.filter((s) => s.status !== 'GRADED');
  }, [allSubmissionsList]);

  const filteredAuditLogs = useMemo(() => {
    const source = serverAuditLogs.length > 0 ? serverAuditLogs : auditLogs;
    return source.filter((log) => {
      if (!auditSearch.trim()) return true;
      const q = auditSearch.toLowerCase();
      return (
        log.action.toLowerCase().includes(q) ||
        log.userId.toLowerCase().includes(q) ||
        log.resource.toLowerCase().includes(q)
      );
    });
  }, [auditLogs, auditSearch, serverAuditLogs]);

  const calYear = calendarDate.getFullYear();
  const calMonth = calendarDate.getMonth();

  const calendarCells = useMemo(() => {
    const firstDayOfMonth = new Date(calYear, calMonth, 1).getDay();
    const mondayOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < mondayOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }, [calYear, calMonth]);

  const monthDeadlineMap = useMemo(() => {
    const map = {};
    assignments.forEach((asg) => {
      const d = new Date(asg.deadline);
      if (d.getFullYear() === calYear && d.getMonth() === calMonth) {
        const dayNum = d.getDate();
        if (!map[dayNum]) map[dayNum] = [];
        map[dayNum].push({ type: 'DEADLINE', title: asg.title, course: asg.courseTitle });
      }
    });
    webinars.forEach((web) => {
      const d = new Date(web.scheduledAt);
      if (d.getFullYear() === calYear && d.getMonth() === calMonth) {
        const dayNum = d.getDate();
        if (!map[dayNum]) map[dayNum] = [];
        map[dayNum].push({ type: 'WEBINAR', title: web.title, course: web.courseTitle });
      }
    });
    return map;
  }, [assignments, webinars, calYear, calMonth]);

  const handlePrevMonth = () => {
    setSelectedCalDay(null);
    setCalendarDate(new Date(calYear, calMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setSelectedCalDay(null);
    setCalendarDate(new Date(calYear, calMonth + 1, 1));
  };

  // ========================================================
  // SESSION BOOTSTRAP (ПРОВЕРКА СОХРАНЁННОГО JWT)
  // ========================================================
  if (booting) {
    return (
      <div className="sso-auth-overlay">
        <div className="sso-auth-card" style={{ textAlign: 'center', padding: '48px 32px' }}>
          <div className="sso-auth-logo" style={{ justifyContent: 'center' }}>
            <span className="logo-icon">S</span>
            <span className="logo-title">STUDEVO</span>
          </div>
          <p style={{ color: '#475569', fontSize: 13, marginTop: 16 }}>Перевірка сесії…</p>
        </div>
      </div>
    );
  }

  // ========================================================
  // LOGIN PAGE (JWT-АУТЕНТИФИКАЦИЯ)
  // ========================================================
  if (!currentUser) {
    return (
      <div className="sso-auth-overlay">
        <div className="sso-auth-card">
          <div className="sso-auth-header">
            <div className="sso-auth-logo">
              <span className="logo-icon">S</span>
              <span className="logo-title">STUDEVO</span>
            </div>
            <h2>Вхід до особистого кабінету</h2>
            <p style={{ color: 'rgba(255,255,255,0.88)', fontSize: 12, margin: '6px 0 0' }}>
              Єдиний вхід для студентів, викладачів і деканату
            </p>
          </div>

          <form className="sso-auth-body" onSubmit={handlePasswordLogin}>
            {loginError && (
              <div className="studevo-alert studevo-alert-danger" style={{ padding: '10px 14px', fontSize: '12.5px' }}>
                <span>{loginError}</span>
              </div>
            )}

            <div className="form-group-field" style={{ marginBottom: 0 }}>
              <label>Логін або електронна пошта</label>
              <input
                type="text"
                className="input-studevo-control"
                placeholder="Введіть логін або email"
                value={loginInput}
                onChange={(e) => setLoginInput(e.target.value)}
                required
              />
            </div>

            <div className="form-group-field" style={{ marginBottom: 0 }}>
              <label>Пароль</label>
              <input
                type="password"
                className="input-studevo-control"
                placeholder="Введіть пароль"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn-studevo-primary" style={{ width: '100%', padding: '10px', fontSize: '14px', marginTop: '4px' }}>
              Увійти
            </button>

            <div className="login-quick-fill-bar">
              <span>Демо-доступ · пароль 123456</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  className="login-quick-chip"
                  onClick={() => {
                    setLoginInput('o.petrenko@univ.edu.ua');
                    setPasswordInput('123456');
                    setLoginError('');
                  }}
                >
                  Студент
                </button>
                <button
                  type="button"
                  className="login-quick-chip"
                  onClick={() => {
                    setLoginInput('d.kovalenko@univ.edu.ua');
                    setPasswordInput('123456');
                    setLoginError('');
                  }}
                >
                  Викладач
                </button>
                <button
                  type="button"
                  className="login-quick-chip"
                  onClick={() => {
                    setLoginInput('dekanat.fiot@univ.edu.ua');
                    setPasswordInput('123456');
                    setLoginError('');
                  }}
                >
                  Деканат
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    );
  }

  const myGroup =
    academicGroups.find((group) => (group.enrolledUserIds || []).includes(currentUser?.id)) || null;

  const currentSemester = courses.reduce(
    (max, course) => Math.max(max, Number(course.semester) || 1),
    1
  );


  const handleOpenAssignment = (assignmentId) => {
    if (!assignmentId) {
      setActiveMenu(userRole === 'student' ? 'assignments' : 'grades');
      return;
    }
    if (userRole === 'student') {
      setSubmissionForm((prev) => ({ ...prev, assignmentId }));
      setActiveMenu('assignments');
      return;
    }
    const submission = allSubmissionsList.find((sub) => sub.assignmentId === assignmentId);
    if (submission) setSelectedSubmissionId(submission.id);
    setActiveMenu('grades');
  };

  const visibleCourses =
    userRole === 'student' ? courses.filter((course) => course.isPublished !== false) : courses;

  const submissionTarget =
    assignments.find((assignment) => assignment.id === submissionForm.assignmentId) || assignments[0] || null;
  const mySubmission = submissionTarget
    ? (submissionTarget.submissions || []).find((submission) => submission.studentId === currentUser?.id)
    : null;
  const allowedSubmissionFormats =
    submissionTarget?.allowedFormats?.length ? submissionTarget.allowedFormats : ['pdf', 'docx'];
  const acceptForSubmission = allowedSubmissionFormats.map((format) => `.${format}`).join(',');

  const conversations = (() => {
    if (!currentUser) return [];
    const map = new Map();
    for (const message of [...inboxMessages, ...sentMessages]) {
      const incoming = message.senderId !== currentUser.id;
      const peerId = incoming ? message.senderId : message.recipientId;
      if (!peerId) continue;
      const peerName = incoming ? message.senderName : message.recipientName;
      const timestamp = new Date(message.createdAt).getTime();
      const existing = map.get(peerId) || {
        id: peerId,
        name: peerName || 'Користувач',
        last: '',
        timestamp: 0,
        unread: 0,
      };
      if (timestamp >= existing.timestamp) {
        existing.last = message.body;
        existing.timestamp = timestamp;
        existing.name = peerName || existing.name;
      }
      if (incoming && !message.readAt) existing.unread += 1;
      map.set(peerId, existing);
    }
    return [...map.values()].sort((a, b) => b.timestamp - a.timestamp);
  })();


  // Role-specific navigation menu
  const roleMenus =
    userRole === 'student'
      ? [
          { id: 'dashboard', label: 'Панель', icon: 'grid' },
          { id: 'courses', label: 'Мої курси', icon: 'book' },
          { id: 'assignments', label: 'Завдання', icon: 'check' },
          { id: 'grades', label: 'Оцінки', icon: 'chart' },
          { id: 'webinars', label: 'Онлайн-заняття', icon: 'video' },
          { id: 'messages', label: 'Повідомлення', icon: 'mail' },
          { id: 'announcements', label: 'Оголошення', icon: 'megaphone' },
          { id: 'profile', label: 'Мій профіль', icon: 'user' },
        ]
      : userRole === 'teacher'
      ? [
          { id: 'dashboard', label: 'Панель', icon: 'grid' },
          { id: 'courses', label: 'Мої курси', icon: 'book' },
          { id: 'assignments', label: 'Завдання', icon: 'check' },
          { id: 'grades', label: 'Оцінювання', icon: 'chart' },
          { id: 'schedule', label: 'Розклад', icon: 'calendar' },
          { id: 'webinars', label: 'Онлайн-заняття', icon: 'video' },
          { id: 'messages', label: 'Повідомлення', icon: 'mail' },
          { id: 'announcements', label: 'Оголошення', icon: 'megaphone' },
          { id: 'profile', label: 'Мій профіль', icon: 'user' },
        ]
      : [
          { id: 'dashboard', label: 'Панель', icon: 'grid' },
          { id: 'groups', label: 'Користувачі та групи', icon: 'users' },
          { id: 'grades', label: 'Відомості', icon: 'chart' },
          { id: 'schedule', label: 'Розклад', icon: 'calendar' },
          { id: 'messages', label: 'Повідомлення', icon: 'mail' },
          { id: 'announcements', label: 'Оголошення', icon: 'megaphone' },
          { id: 'profile', label: 'Мій профіль', icon: 'user' },
          { id: 'audit', label: 'Журнал', icon: 'shield' },
        ];

  return (
    <div className={`studevo-app-shell role-theme-${userRole}`}>
      {/* ========================================================
          LEFT COLUMN (260px) - NAVIGATION & PROFILE
          ======================================================== */}
      <aside className="studevo-sidebar-nav">
        <div>
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
              <span className="studevo-brand-subtitle">
                {userRole === 'student'
                  ? 'Кабінет студента'
                  : userRole === 'teacher'
                  ? 'Кабінет викладача'
                  : 'Панель деканату'}
              </span>
            </div>
          </div>

          <ul className="studevo-menu-list">
            {roleMenus.map((item) => (
              <li key={item.id}>
                <button
                  className={`studevo-menu-item ${activeMenu === item.id ? 'active' : ''}`}
                  onClick={() => setActiveMenu(item.id)}
                >
                  {item.icon === 'grid' && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect width="7" height="9" x="3" y="3" rx="1"></rect>
                      <rect width="7" height="5" x="14" y="3" rx="1"></rect>
                      <rect width="7" height="9" x="14" y="12" rx="1"></rect>
                      <rect width="7" height="5" x="3" y="16" rx="1"></rect>
                    </svg>
                  )}
                  {item.icon === 'book' && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                    </svg>
                  )}
                  {item.icon === 'check' && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 11l3 3L22 4"></path>
                      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                    </svg>
                  )}
                  {item.icon === 'chart' && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" x2="18" y1="20" y2="10"></line>
                      <line x1="12" x2="12" y1="20" y2="4"></line>
                      <line x1="6" x2="6" y1="20" y2="14"></line>
                    </svg>
                  )}
                  {item.icon === 'video' && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="23 7 16 12 23 17 23 7"></polygon>
                      <rect width="15" height="14" x="1" y="5" rx="2" ry="2"></rect>
                    </svg>
                  )}
                  {item.icon === 'users' && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                      <circle cx="9" cy="7" r="4"></circle>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                  )}
                  {item.icon === 'shield' && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                    </svg>
                  )}
                  {item.icon === 'mail' && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect width="20" height="16" x="2" y="4" rx="2"></rect>
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
                    </svg>
                  )}
                  {item.icon === 'calendar' && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect width="18" height="18" x="3" y="4" rx="2"></rect>
                      <line x1="16" x2="16" y1="2" y2="6"></line>
                      <line x1="8" x2="8" y1="2" y2="6"></line>
                      <line x1="3" x2="21" y1="10" y2="10"></line>
                    </svg>
                  )}
                  {item.icon === 'megaphone' && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m3 11 18-5v12L3 13v-2z"></path>
                      <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"></path>
                    </svg>
                  )}
                  {item.icon === 'user' && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                      <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                  )}
                  <span>{item.label}</span>
                  {item.id === 'messages' && unreadMessages > 0 && (
                    <span
                      style={{
                        marginLeft: 'auto',
                        background: activeMenu === 'messages' ? '#fff' : 'var(--studevo-red)',
                        color: activeMenu === 'messages' ? 'var(--studevo-red-dark)' : '#fff',
                        fontSize: '10.5px',
                        fontWeight: 800,
                        padding: '1px 6px',
                        borderRadius: '10px',
                      }}
                    >
                      {unreadMessages}
                    </span>
                  )}
                  {item.id === 'grades' && userRole === 'teacher' && ungradedSubmissions.length > 0 && (
                    <span
                      style={{
                        marginLeft: 'auto',
                        background: activeMenu === 'grades' ? '#fff' : 'var(--studevo-red)',
                        color: activeMenu === 'grades' ? 'var(--studevo-red-dark)' : '#fff',
                        fontSize: '10.5px',
                        fontWeight: 800,
                        padding: '1px 6px',
                        borderRadius: '10px',
                      }}
                    >
                      {ungradedSubmissions.length}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>

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
              </div>
            </div>
          </div>

          <button
            className="logout-action-btn"
            onClick={handleLogout}
          >
            <span>Вийти з акаунту</span>
          </button>
        </div>
      </aside>

      {/* ========================================================
          CENTER COLUMN (1fr) - WORKSPACE
          ======================================================== */}
      <main className="studevo-workspace">
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

        {/* ========================================================
            1A. STUDENT DASHBOARD
            ======================================================== */}
        {activeMenu === 'dashboard' && (
          <Dashboard
            userRole={userRole}
            currentUser={currentUser}
            courses={courses}
            assignments={assignments}
            grades={grades}
            webinars={webinars}
            academicGroups={academicGroups}
            schedule={schedule}
            allEnrollments={allEnrollments}
            analytics={analytics}
            announcements={announcements}
            myGroup={myGroup}
            semester={currentSemester}
            ungradedSubmissions={ungradedSubmissions}
            unreadMessages={unreadMessages}
            averageStudentGrade={averageStudentGrade}
            getEctsLetter={getEctsLetter}
            onOpenCourse={(courseId) => setSelectedCourseId(courseId)}
            onOpenAssignment={handleOpenAssignment}
            onOpenGrades={() => setActiveMenu('grades')}
            onOpenWebinars={() => setActiveMenu('webinars')}
            onOpenGroups={() => setActiveMenu('groups')}
            onOpenSchedule={() => setActiveMenu('schedule')}
            onOpenAnnouncements={() => setActiveMenu('announcements')}
            onOpenMessages={() => setActiveMenu('messages')}
          />
        )}

        {/* 2. COURSES & SYLLABUS */}
        {activeMenu === 'courses' && (
          <div>
            <div className="section-header-row">
              <h2 className="section-title">Навчальні дисципліни та силабуси</h2>
            </div>

            {userRole === 'teacher' && (
              <div className="studevo-card" style={{ marginBottom: '20px' }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', color: 'var(--studevo-red-dark)' }}>
                  Додати нову навчальну дисципліну
                </h3>
                <form onSubmit={handleCreateCourse}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.2fr', gap: '14px' }}>
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
                    <div className="form-group-field">
                      <label>Обсяг (годин)</label>
                      <input
                        type="number"
                        min="30"
                        max="300"
                        step="15"
                        className="input-studevo-control"
                        value={newCourse.totalHours}
                        onChange={(e) => setNewCourse({ ...newCourse, totalHours: Number(e.target.value) })}
                      />
                    </div>
                    <div className="form-group-field">
                      <label>Обкладинка курсу</label>
                      <select
                        className="input-studevo-control"
                        value={newCourse.cover}
                        onChange={(e) => setNewCourse({ ...newCourse, cover: e.target.value })}
                      >
                        <option value="/course-coding.jpg">Програмування та ІТ</option>
                        <option value="/course-webdesign.jpg">Дизайн та інтерфейси</option>
                        <option value="/course-math.jpg">Математика та алгоритми</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-group-field">
                    <label>Опис курсу</label>
                    <textarea
                      rows="2"
                      className="input-studevo-control"
                      placeholder="Короткий опис тем та очікуваних результатів навчання..."
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
              {visibleCourses.map((c) => (
                <div
                  key={c.id}
                  className="course-academic-card"
                  onClick={() => {
                    setSelectedCourseId(c.id);
                    setActiveLessonId(c.modules?.[0]?.lessons?.[0]?.id || null);
                  }}
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
                        <span>{modulesLabel(c.modules?.length || 0)} • Семестр {c.semester} • {c.totalHours} год.</span>
                      </div>
                      <p style={{ fontSize: '12px', color: '#6c757d', margin: '0 0 12px 0' }}>
                        {c.description}
                      </p>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                      <button
                        className="btn-studevo-outline"
                        style={{ fontSize: '11.5px', padding: '5px 10px' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCourseId(c.id);
                          setActiveLessonId(c.modules?.[0]?.lessons?.[0]?.id || null);
                        }}
                      >
                        Програма та уроки ({c.progress}%)
                      </button>

                      {userRole === 'teacher' && !c.isPublished && (
                        <button
                          className="btn-studevo-primary"
                          style={{ fontSize: '11.5px', padding: '5px 10px' }}
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
                {userRole === 'student' ? 'Мої завдання та здача робіт' : 'Навчальні завдання та критерії оцінювання'}
              </h2>
            </div>

            {userRole === 'teacher' && (
              <div className="studevo-card" style={{ marginBottom: '20px' }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', color: 'var(--studevo-red-dark)' }}>
                  Створити нове завдання
                </h3>
                <form onSubmit={handleCreateAssignment}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1.6fr 0.8fr 1.1fr', gap: '12px' }}>
                    <div className="form-group-field">
                      <label>Навчальна дисципліна</label>
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
                      <label>Назва завдання</label>
                      <input
                        type="text"
                        className="input-studevo-control"
                        placeholder="напр.: Лабораторна робота 5: Проектування мікросервісів"
                        value={newAssignment.title}
                        onChange={(e) => setNewAssignment({ ...newAssignment, title: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group-field">
                      <label>Тип роботи</label>
                      <select
                        className="input-studevo-control"
                        value={newAssignment.type}
                        onChange={(e) => setNewAssignment({ ...newAssignment, type: e.target.value })}
                      >
                        <option value="Лабораторна">Лабораторна</option>
                        <option value="Практична">Практична</option>
                        <option value="Курсова">Курсова</option>
                      </select>
                    </div>
                    <div className="form-group-field">
                      <label>Термін здачі</label>
                      <input
                        type="datetime-local"
                        className="input-studevo-control"
                        value={newAssignment.deadline}
                        onChange={(e) => setNewAssignment({ ...newAssignment, deadline: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                    <div className="form-group-field">
                      <label>Дата відкриття (необов'язково)</label>
                      <input
                        type="datetime-local"
                        className="input-studevo-control"
                        value={newAssignment.openAt}
                        onChange={(e) => setNewAssignment({ ...newAssignment, openAt: e.target.value })}
                      />
                    </div>
                    <div className="form-group-field">
                      <label>Формати відповіді (через кому)</label>
                      <input
                        type="text"
                        className="input-studevo-control"
                        placeholder="pdf, docx"
                        value={newAssignment.allowedFormats}
                        onChange={(e) => setNewAssignment({ ...newAssignment, allowedFormats: e.target.value })}
                      />
                    </div>
                  </div>

                  <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '8px', marginBottom: '12px', border: '1px solid #e9ecef' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '8px', color: 'var(--studevo-red-dark)' }}>
                      Критерії оцінювання (Усього: {Number(newAssignment.crit1Max) + Number(newAssignment.crit2Max) + Number(newAssignment.crit3Max)} балів):
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr 1fr 2fr 1fr', gap: '8px' }}>
                      <input
                        type="text"
                        className="input-studevo-control"
                        value={newAssignment.crit1Name}
                        onChange={(e) => setNewAssignment({ ...newAssignment, crit1Name: e.target.value })}
                        placeholder="Критерій 1"
                      />
                      <input
                        type="number"
                        className="input-studevo-control"
                        value={newAssignment.crit1Max}
                        onChange={(e) => setNewAssignment({ ...newAssignment, crit1Max: Number(e.target.value) })}
                      />
                      <input
                        type="text"
                        className="input-studevo-control"
                        value={newAssignment.crit2Name}
                        onChange={(e) => setNewAssignment({ ...newAssignment, crit2Name: e.target.value })}
                        placeholder="Критерій 2"
                      />
                      <input
                        type="number"
                        className="input-studevo-control"
                        value={newAssignment.crit2Max}
                        onChange={(e) => setNewAssignment({ ...newAssignment, crit2Max: Number(e.target.value) })}
                      />
                      <input
                        type="text"
                        className="input-studevo-control"
                        value={newAssignment.crit3Name}
                        onChange={(e) => setNewAssignment({ ...newAssignment, crit3Name: e.target.value })}
                        placeholder="Критерій 3"
                      />
                      <input
                        type="number"
                        className="input-studevo-control"
                        value={newAssignment.crit3Max}
                        onChange={(e) => setNewAssignment({ ...newAssignment, crit3Max: Number(e.target.value) })}
                      />
                    </div>
                  </div>

                  <button type="submit" className="btn-studevo-primary">
                    Опублікувати завдання
                  </button>
                </form>
              </div>
            )}

            {userRole === 'student' && (
              <div className="studevo-card" style={{ marginBottom: '20px', background: '#fff9f9', border: '1px solid #ffc9c9' }}>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '14.5px', color: 'var(--studevo-red-dark)' }}>
                  Відправлення виконаної роботи на перевірку
                </h3>
                {submissionTarget && (
                  <div className="assignment-hint">
                    <div className="assignment-hint-title">{submissionTarget.title}</div>
                    <div className="dash-hint">
                      {submissionTarget.courseTitle} • {submissionTarget.type || 'Завдання'} • до{' '}
                      {new Date(submissionTarget.deadline).toLocaleString('uk-UA', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      • макс {submissionTarget.maxScore}
                    </div>
                    <div className="format-badges">
                      {allowedSubmissionFormats.map((format) => (
                        <span key={format} className="format-badge">
                          {format.toUpperCase()}
                        </span>
                      ))}
                    </div>
                    {mySubmission && (
                      <span className={`dash-status ${mySubmission.status === 'GRADED' ? 'done' : 'pending'}`}>
                        {mySubmission.status === 'GRADED'
                          ? `Оцінено ${mySubmission.score}/${submissionTarget.maxScore}`
                          : 'Здано, очікує перевірки'}
                      </span>
                    )}
                  </div>
                )}

                <form onSubmit={handleStudentSubmit}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1.2fr', gap: '14px', marginBottom: '12px' }}>
                    <div className="form-group-field" style={{ marginBottom: 0 }}>
                      <label>Оберіть завдання</label>
                      <select
                        className="input-studevo-control"
                        value={submissionForm.assignmentId}
                        onChange={(e) => setSubmissionForm({ ...submissionForm, assignmentId: e.target.value })}
                      >
                        {assignments.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.title} ({a.courseTitle})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group-field" style={{ marginBottom: 0 }}>
                      <label>
                        Файл звіту ({allowedSubmissionFormats.map((format) => format.toUpperCase()).join(', ')})
                      </label>
                      <label className="file-dropzone-box">
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <strong>{submissionForm.fileName || 'Файл не вибрано'}</strong>
                          {submissionForm.fileSize && (
                            <span style={{ fontSize: '11px', color: '#6c757d', marginLeft: '8px' }}>
                              ({submissionForm.fileSize})
                            </span>
                          )}
                        </div>
                        <span className="btn-studevo-outline" style={{ padding: '3px 8px', fontSize: '11px', flexShrink: 0 }}>
                          Обрати файл...
                        </span>
                        <input
                          key={submissionForm.fileName || 'empty'}
                          type="file"
                          accept={acceptForSubmission}
                          style={{ display: 'none' }}
                          onChange={handleFileInputChange}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="form-group-field">
                    <label>Коментар або посилання на репозиторій</label>
                    <input
                      type="text"
                      className="input-studevo-control"
                      value={submissionForm.comment}
                      onChange={(e) => setSubmissionForm({ ...submissionForm, comment: e.target.value })}
                      required
                    />
                  </div>
                  <button type="submit" className="btn-studevo-primary">
                    Здати роботу
                  </button>
                </form>
              </div>
            )}

            <div className="studevo-card">
              <table className="studevo-table">
                <thead>
                  <tr>
                    <th>Назва завдання</th>
                    <th>Дисципліна</th>
                    <th>Термін здачі</th>
                    <th>Макс. бал</th>
                    <th>Критерії оцінювання</th>
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((asg) => {
                    const latestSub = asg.submissions?.[0];
                    return (
                      <tr key={asg.id}>
                        <td>
                          <strong>{asg.title}</strong>
                          <div style={{ fontSize: '11px', color: '#868e96', marginTop: '2px' }}>
                            {asg.type}
                          </div>
                        </td>
                        <td style={{ color: 'var(--studevo-text-muted)' }}>{asg.courseTitle}</td>
                        <td>
                          <span style={{ color: 'var(--studevo-red-dark)', fontWeight: 600 }}>
                            {new Date(asg.deadline).toLocaleDateString('uk-UA', {
                              day: 'numeric',
                              month: 'long',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </td>
                        <td><strong>{asg.maxScore}</strong></td>
                        <td>
                          <div style={{ fontSize: '11px', color: '#495057' }}>
                            {(asg.criteria || []).map((c) => `${c.name} (${c.max})`).join(' • ')}
                          </div>
                        </td>
                        <td>
                          {latestSub ? (
                            <div>
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '3px 9px',
                                  borderRadius: '10px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  backgroundColor: latestSub.status === 'GRADED' ? '#e7f5ff' : '#ebfbee',
                                  color: latestSub.status === 'GRADED' ? '#1971c2' : '#2b8a3e',
                                }}
                              >
                                {latestSub.status === 'GRADED'
                                  ? `Оцінено: ${latestSub.score}/${asg.maxScore}`
                                  : `Здано: ${latestSub.fileName}`}
                              </span>
                              {userRole === 'teacher' && (
                                <div style={{ marginTop: '5px' }}>
                                  <button
                                    className="btn-studevo-outline"
                                    style={{ padding: '2px 8px', fontSize: '11px' }}
                                    onClick={() => {
                                      handleSelectSubmissionForGrading(latestSub.id);
                                      setActiveMenu('grades');
                                    }}
                                  >
                                    Перевірити &rarr;
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: '10px',
                                fontSize: '11px',
                                fontWeight: 600,
                                backgroundColor: '#fff5f5',
                                color: '#c92a2a',
                              }}
                            >
                              Очікує на здачу
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. GRADES & EVALUATION */}
        {activeMenu === 'grades' && (
          <div>
            <div className="section-header-row">
              <h2 className="section-title">
                {userRole === 'student'
                  ? 'Мій щоденник оцінок'
                  : userRole === 'teacher'
                  ? 'Перевірка робіт та журнал успішності'
                  : 'Відомості успішності факультету'}
              </h2>
              <button className="btn-studevo-outline" onClick={handleExportGradesCsv}>
                Завантажити відомість (CSV)
              </button>
            </div>

            {userRole === 'admin' && (
              <div className="dean-readonly-note">
                <strong>Режим перегляду.</strong> Деканат переглядає відомості та успішність факультету.
                Оцінювання робіт виконують лише викладачі.
              </div>
            )}

            {userRole === 'teacher' && (
              <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: '22px', marginBottom: '22px' }}>
                <div className="studevo-card">
                  <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', color: 'var(--studevo-red-dark)' }}>
                    Оцінювання роботи за критеріями
                  </h3>
                  <form onSubmit={handleGradeWithStrategy}>
                    <div className="form-group-field">
                      <label>Робота студента</label>
                      <select
                        className="input-studevo-control"
                        value={currentGradingSub?.id || ''}
                        onChange={(e) => handleSelectSubmissionForGrading(e.target.value)}
                      >
                        {allSubmissionsList.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.studentName} ({s.group}) — {s.assignmentTitle}
                          </option>
                        ))}
                      </select>
                    </div>

                    {currentGradingSub && (
                      <div style={{ fontSize: '11.5px', color: '#495057', marginBottom: '10px', background: 'var(--studevo-red-light)', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--studevo-accent-subtle)' }}>
                        <div>
                          <strong>Файл:</strong> {currentGradingSub.fileName || '—'} ({currentGradingSub.fileSize || '—'})
                          {currentGradingSub.hasFile && (
                            <button
                              type="button"
                              className="btn-studevo-outline"
                              style={{ marginLeft: '10px', padding: '2px 8px', fontSize: '11px' }}
                              onClick={() => handleDownloadSubmission(currentGradingSub)}
                            >
                              Завантажити
                            </button>
                          )}
                        </div>
                        <div><strong>Коментар:</strong> {currentGradingSub.comment}</div>
                        {currentGradingSub.isLate && (
                          <div style={{ color: '#d9480f', fontWeight: 600 }}>Роботу здано після дедлайну</div>
                        )}
                      </div>
                    )}

                    <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '8px', marginBottom: '14px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '8px', color: '#343a40' }}>
                        Бали за критеріями:
                      </div>
                      {(currentGradingSub?.criteria || [
                        { id: 'clean_arch', name: 'Чиста архітектура', max: 35 },
                        { id: 'patterns', name: 'Патерни проектування', max: 35 },
                        { id: 'tests', name: 'Модульні тести', max: 30 },
                      ]).map((crit) => (
                        <div
                          key={crit.id}
                          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '12px' }}
                        >
                          <span>{crit.name} (макс. {crit.max}):</span>
                          <input
                            type="number"
                            min="0"
                            max={crit.max}
                            className="input-studevo-control"
                            style={{ width: '72px', padding: '4px 8px' }}
                            value={grading.criteriaScores[crit.id] ?? 0}
                            onChange={(e) =>
                              setGrading({
                                ...grading,
                                criteriaScores: {
                                  ...grading.criteriaScores,
                                  [crit.id]: Math.min(crit.max, Math.max(0, Number(e.target.value))),
                                },
                              })
                            }
                          />
                        </div>
                      ))}
                    </div>

                    <div className="form-group-field">
                      <label>Правило нарахування балів</label>
                      <select
                        className="input-studevo-control"
                        value={grading.rule}
                        onChange={(e) => setGrading({ ...grading, rule: e.target.value })}
                      >
                        <option value="AUTO">
                          Автоматично (штраф 20%, якщо здано після дедлайну)
                        </option>
                        <option value="STANDARD">Стандартний розрахунок за критеріями</option>
                        <option value="LATE_PENALTY">Зниження на 20% (пізня здача)</option>
                        <option value="EXCELLENCE_BONUS">Заохочувальний бонус (+5 балів)</option>
                      </select>
                    </div>

                    <div className="form-group-field">
                      <label>Коментар викладача</label>
                      <textarea
                        rows="2"
                        className="input-studevo-control"
                        value={grading.feedback}
                        onChange={(e) => setGrading({ ...grading, feedback: e.target.value })}
                      />
                    </div>

                    <button type="submit" className="btn-studevo-primary" style={{ width: '100%' }}>
                      Виставити оцінку ({liveFinalScore} балів, ECTS: {getEctsLetter(liveFinalScore)})
                    </button>
                  </form>
                </div>

                <div className="studevo-card">
                  <h3 style={{ margin: '0 0 14px 0', fontSize: '15px', color: 'var(--studevo-red-dark)' }}>
                    Підсумок оцінювання
                  </h3>
                  <div style={{ background: 'var(--studevo-red-light)', border: '1px solid var(--studevo-accent-subtle)', borderRadius: '10px', padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
                      <div>
                        <span style={{ fontSize: '11px', color: '#868e96', textTransform: 'uppercase' }}>Студент</span>
                        <div style={{ fontSize: '15px', fontWeight: 700 }}>
                          {(gradingResult || currentGradingSub)?.studentName || '—'}
                        </div>
                        <div style={{ fontSize: '12px', color: '#6c757d' }}>
                          {(gradingResult || currentGradingSub)?.assignmentTitle}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '11px', color: '#868e96', textTransform: 'uppercase' }}>Правило розрахунку</span>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--studevo-red-dark)' }}>
                          {effectiveRule === 'LATE_PENALTY'
                            ? 'Зниження на 20%'
                            : effectiveRule === 'EXCELLENCE_BONUS'
                            ? 'Бонус +5 балів'
                            : grading.rule === 'AUTO'
                            ? 'Автоматично (без штрафу)'
                            : 'Стандартний розрахунок'}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '30px', margin: '16px 0', padding: '14px 0', borderTop: '1px dashed var(--studevo-border-strong)', borderBottom: '1px dashed var(--studevo-border-strong)' }}>
                      <div>
                        <span style={{ fontSize: '12px', color: '#6c757d' }}>Сума за критеріями:</span>
                        <div style={{ fontSize: '24px', fontWeight: 700, color: '#495057' }}>{liveRawScore}</div>
                      </div>
                      <div>
                        <span style={{ fontSize: '12px', color: '#6c757d' }}>Підсумковий бал у журнал:</span>
                        <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--studevo-red-dark)' }}>
                          {liveFinalScore} / {currentGradingSub?.maxScore || 100}{' '}
                          <span className="ects-badge">{getEctsLetter(liveFinalScore)}</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ fontSize: '12.5px', color: '#343a40' }}>
                      <strong>Коментар викладача:</strong> {grading.feedback}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="studevo-card">
              <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', color: 'var(--studevo-red-dark)' }}>
                {userRole === 'student'
                  ? `Успішність студента (${currentUser.name}) — Середній бал: ${averageStudentGrade}`
                  : 'Відомість оцінок'}
              </h3>
              <table className="studevo-table">
                <thead>
                  <tr>
                    {userRole !== 'student' && <th>Студент / Група</th>}
                    <th>Навчальна дисципліна</th>
                    <th>Завдання</th>
                    <th>Дата</th>
                    <th>Бал / Макс</th>
                    <th>Шкала ECTS</th>
                    <th>Коментар викладача</th>
                  </tr>
                </thead>
                <tbody>
                  {grades.map((g) => (
                    <tr key={g.id}>
                      {userRole !== 'student' && (
                        <td>
                          <strong>{g.studentName}</strong>
                          <div style={{ fontSize: '11px', color: '#868e96' }}>{g.group}</div>
                        </td>
                      )}
                      <td><strong>{g.courseTitle}</strong></td>
                      <td>{g.assignmentTitle}</td>
                      <td>{g.submittedAt}</td>
                      <td>
                        <strong style={{ color: 'var(--studevo-red-dark)', fontSize: '15px' }}>{g.finalScore}</strong> / {g.maxScore}
                      </td>
                      <td>
                        <span className="ects-badge">{getEctsLetter(g.finalScore)}</span>
                      </td>
                      <td style={{ color: '#495057', fontSize: '12px' }}>{g.feedback}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 5. WEBINARS & ONLINE CLASSES */}
        {activeMenu === 'webinars' && (
          <WebinarsPage
            webinars={webinars}
            userRole={userRole}
            courses={courses}
            newWebinarForm={newWebinarForm}
            setNewWebinarForm={setNewWebinarForm}
            onCreate={handleScheduleWebinar}
            onChangeStatus={handleChangeWebinarStatus}
            onDelete={handleDeleteWebinar}
            onUpdateMeeting={handleUpdateWebinarMeeting}
          />
        )}

        {activeMenu === 'groups' && userRole === 'admin' && (
          <div>
            <div className="section-header-row">
              <h2 className="section-title">Академічні групи факультету</h2>
            </div>

            <div className="studevo-card" style={{ marginBottom: '20px' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', color: 'var(--studevo-red-dark)' }}>
                Додати нову академічну групу
              </h3>
              <form onSubmit={handleCreateGroup}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr 1fr', gap: '14px' }}>
                  <div className="form-group-field">
                    <label>Шифр групи</label>
                    <input
                      type="text"
                      className="input-studevo-control"
                      placeholder="наприклад: ІПЗ-413"
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
                  Зберегти групу
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
                    <th>Закріплені дисципліни</th>
                    <th>Куратор</th>
                    <th>Дії</th>
                  </tr>
                </thead>
                <tbody>
                  {academicGroups.map((g) => (
                    <tr key={g.id}>
                      <td><strong>{g.name}</strong></td>
                      <td>{g.faculty}</td>
                      <td>{g.studyYear} курс</td>
                      <td>{studentsLabel(g.studentsCount)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {(g.assignedCourseIds || []).map((cid) => {
                            const cObj = courses.find((c) => c.id === cid);
                            return cObj ? (
                              <span
                                key={cid}
                                style={{
                                  fontSize: '11px',
                                  background: 'var(--studevo-red-light)',
                                  color: 'var(--studevo-red-dark)',
                                  border: '1px solid var(--studevo-accent-subtle)',
                                  padding: '2px 7px',
                                  borderRadius: '10px',
                                  fontWeight: 600,
                                }}
                              >
                                {cObj.title}
                              </span>
                            ) : null;
                          })}
                        </div>
                      </td>
                      <td>
                        <select
                          className="input-studevo-control"
                          style={{ padding: '4px 8px', fontSize: '12px', minWidth: '168px' }}
                          value={g.curatorId || ''}
                          onChange={(e) => handleAssignCurator(g.id, e.target.value)}
                        >
                          <option value="">— не призначено —</option>
                          {systemUsers
                            .filter((user) => user.role === 'TEACHER' || user.role === 'ADMIN')
                            .map((user) => (
                              <option key={user.id} value={user.id}>
                                {user.fullName}
                              </option>
                            ))}
                        </select>
                      </td>
                      <td>
                        <button
                          className="btn-studevo-outline"
                          style={{ fontSize: '11.5px', padding: '5px 10px' }}
                          onClick={() => setManagingGroupId(g.id)}
                        >
                          Дисципліни та студенти
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="studevo-card" style={{ marginTop: '20px' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', color: 'var(--studevo-red-dark)' }}>
                Дисципліни та викладачі
              </h3>
              <table className="studevo-table">
                <thead>
                  <tr>
                    <th>Дисципліна</th>
                    <th>Відповідальний викладач</th>
                    <th>Призначити</th>
                  </tr>
                </thead>
                <tbody>
                  {courses.map((course) => {
                    const owner = systemUsers.find((user) => user.id === course.ownerId);
                    return (
                      <tr key={course.id}>
                        <td>
                          <strong>{course.title}</strong>
                        </td>
                        <td>{owner?.fullName || '—'}</td>
                        <td>
                          <select
                            className="input-studevo-control"
                            style={{ padding: '4px 8px', fontSize: '12px' }}
                            value={course.ownerId || ''}
                            onChange={(e) => handleAssignTeacher(course.id, e.target.value)}
                          >
                            <option value="">— не призначено —</option>
                            {systemUsers
                              .filter((user) => user.role === 'TEACHER' || user.role === 'ADMIN')
                              .map((user) => (
                                <option key={user.id} value={user.id}>
                                  {user.fullName}
                                </option>
                              ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="studevo-card" style={{ marginTop: '20px' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', color: 'var(--studevo-red-dark)' }}>
                Користувачі
              </h3>
              <table className="studevo-table">
                <thead>
                  <tr>
                    <th>ПІБ</th>
                    <th>Email</th>
                    <th>Роль</th>
                    <th>Статус</th>
                    <th>Група</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {systemUsers.map((user) => {
                    const enrollment = allEnrollments.find((item) => item.userId === user.id);
                    const roleLabel =
                      user.role === 'STUDENT' ? 'Студент' : user.role === 'TEACHER' ? 'Викладач' : 'Деканат';
                    return (
                      <tr key={user.id}>
                        <td>
                          <strong>{user.fullName}</strong>
                          {user.username ? (
                            <span style={{ color: '#868e96', fontSize: '11.5px' }}> @{user.username}</span>
                          ) : null}
                        </td>
                        <td>{user.email}</td>
                        <td>{roleLabel}</td>
                        <td>
                          <select
                            className="input-studevo-control"
                            style={{ padding: '4px 8px', fontSize: '12px' }}
                            value={user.status || 'ACTIVE'}
                            onChange={(e) => handleUserStatus(user.id, e.target.value)}
                          >
                            <option value="ACTIVE">Навчається</option>
                            <option value="EXPELLED">Відрахований</option>
                            <option value="ACADEMIC_LEAVE">Академвідпустка</option>
                          </select>
                        </td>
                        <td>
                          <select
                            className="input-studevo-control"
                            style={{ padding: '4px 8px', fontSize: '12px' }}
                            value={enrollment?.groupId || ''}
                            onChange={(e) => handleTransferUser(user.id, e.target.value)}
                          >
                            <option value="">— не зараховано —</option>
                            {academicGroups.map((group) => (
                              <option key={group.id} value={group.id}>
                                {group.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn-studevo-outline"
                            style={{ padding: '4px 10px', fontSize: '11.5px' }}
                            onClick={() => handleStartEditUser(user)}
                          >
                            Редагувати
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {systemUsers.length === 0 && (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', color: '#868e96' }}>
                        Користувачів не знайдено
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="studevo-card" style={{ marginTop: '20px' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', color: 'var(--studevo-red-dark)' }}>
                Створити користувача
              </h3>
              <form onSubmit={handleCreateUser}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.4fr 1fr 1fr 1fr', gap: '10px' }}>
                  <div className="form-group-field">
                    <label>ПІБ</label>
                    <input
                      type="text"
                      className="input-studevo-control"
                      value={newUserForm.fullName}
                      onChange={(e) => setNewUserForm({ ...newUserForm, fullName: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group-field">
                    <label>Email</label>
                    <input
                      type="email"
                      className="input-studevo-control"
                      value={newUserForm.email}
                      onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group-field">
                    <label>Логін</label>
                    <input
                      type="text"
                      className="input-studevo-control"
                      value={newUserForm.username}
                      onChange={(e) => setNewUserForm({ ...newUserForm, username: e.target.value })}
                    />
                  </div>
                  <div className="form-group-field">
                    <label>Пароль</label>
                    <input
                      type="text"
                      className="input-studevo-control"
                      value={newUserForm.password}
                      onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group-field">
                    <label>Роль</label>
                    <select
                      className="input-studevo-control"
                      value={newUserForm.role}
                      onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value })}
                    >
                      <option value="STUDENT">Студент</option>
                      <option value="TEACHER">Викладач</option>
                      <option value="ADMIN">Деканат</option>
                    </select>
                  </div>
                </div>
                <button type="submit" className="btn-studevo-primary" style={{ marginTop: '12px' }}>
                  Створити
                </button>
              </form>
            </div>
          </div>
        )}

        {/* 7. SCHEDULE MANAGEMENT (teacher / dean) */}
        {activeMenu === 'schedule' && (userRole === 'teacher' || userRole === 'admin') && (
          <div>
            <div className="section-header-row">
              <h2 className="section-title">Розклад занять</h2>
            </div>

            <div className="studevo-card" style={{ marginBottom: '20px' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', color: 'var(--studevo-red-dark)' }}>
                Додати пару
              </h3>
              <form onSubmit={handleCreateSchedule}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 0.8fr', gap: '12px' }}>
                  <div className="form-group-field">
                    <label>Дисципліна</label>
                    <select
                      className="input-studevo-control"
                      value={scheduleForm.courseId}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, courseId: e.target.value })}
                      required
                    >
                      <option value="">— оберіть —</option>
                      {courses
                        .filter(
                          (course) =>
                            userRole === 'admin' || !course.ownerId || course.ownerId === currentUser?.id
                        )
                        .map((course) => (
                          <option key={course.id} value={course.id}>
                            {course.title}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="form-group-field">
                    <label>Група</label>
                    <select
                      className="input-studevo-control"
                      value={scheduleForm.groupId}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, groupId: e.target.value })}
                      required
                    >
                      <option value="">— оберіть —</option>
                      {academicGroups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group-field">
                    <label>День</label>
                    <select
                      className="input-studevo-control"
                      value={scheduleForm.weekday}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, weekday: Number(e.target.value) })}
                    >
                      {['Понеділок', 'Вівторок', 'Середа', 'Четвер', "П'ятниця", 'Субота', 'Неділя'].map(
                        (day, index) => (
                          <option key={day} value={index + 1}>
                            {day}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '0.8fr 0.8fr 1fr 1fr 1.4fr', gap: '12px', marginTop: '12px' }}>
                  <div className="form-group-field">
                    <label>Початок</label>
                    <input
                      type="time"
                      className="input-studevo-control"
                      value={scheduleForm.startTime}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, startTime: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group-field">
                    <label>Кінець</label>
                    <input
                      type="time"
                      className="input-studevo-control"
                      value={scheduleForm.endTime}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, endTime: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group-field">
                    <label>Аудиторія</label>
                    <input
                      type="text"
                      className="input-studevo-control"
                      value={scheduleForm.room}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, room: e.target.value })}
                    />
                  </div>
                  <div className="form-group-field">
                    <label>Тип</label>
                    <select
                      className="input-studevo-control"
                      value={scheduleForm.lessonType}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, lessonType: e.target.value })}
                    >
                      <option value="Лекція">Лекція</option>
                      <option value="Практика">Практика</option>
                      <option value="Лабораторна">Лабораторна</option>
                    </select>
                  </div>
                  <div className="form-group-field">
                    <label>Посилання на онлайн</label>
                    <input
                      type="url"
                      className="input-studevo-control"
                      value={scheduleForm.onlineUrl}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, onlineUrl: e.target.value })}
                      placeholder="https://..."
                    />
                  </div>
                </div>
                <button type="submit" className="btn-studevo-primary" style={{ marginTop: '12px' }}>
                  Додати пару
                </button>
              </form>
            </div>

            <div className="studevo-card">
              <table className="studevo-table">
                <thead>
                  <tr>
                    <th>День / час</th>
                    <th>Дисципліна</th>
                    <th>Група</th>
                    <th>Аудиторія</th>
                    <th>Тип</th>
                    <th>Дії</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', color: '#868e96' }}>
                        Розклад порожній
                      </td>
                    </tr>
                  ) : (
                    schedule.map((entry) => (
                      <tr key={entry.id}>
                        <td>
                          {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'][Number(entry.weekday) - 1]}{' '}
                          {entry.startTime}–{entry.endTime}
                        </td>
                        <td>{entry.courseTitle}</td>
                        <td>{academicGroups.find((g) => g.id === entry.groupId)?.name || entry.groupId}</td>
                        <td>{entry.room || '—'}</td>
                        <td>{entry.lessonType}</td>
                        <td>
                          <button
                            className="btn-studevo-outline"
                            style={{ fontSize: '11.5px', padding: '4px 10px' }}
                            onClick={() => handleDeleteSchedule(entry.id)}
                          >
                            Видалити
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 8. ANNOUNCEMENTS */}
        {activeMenu === 'announcements' && (
          <div>
            <div className="section-header-row">
              <h2 className="section-title">Оголошення</h2>
            </div>

            {(userRole === 'teacher' || userRole === 'admin') && (
              <div className="studevo-card" style={{ marginBottom: '20px' }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', color: 'var(--studevo-red-dark)' }}>
                  Нове оголошення
                </h3>
                <form onSubmit={handleCreateAnnouncement}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr', gap: '12px' }}>
                    <div className="form-group-field">
                      <label>Заголовок</label>
                      <input
                        type="text"
                        className="input-studevo-control"
                        value={announcementForm.title}
                        onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group-field">
                      <label>Аудиторія</label>
                      <select
                        className="input-studevo-control"
                        value={announcementForm.audience}
                        onChange={(e) => setAnnouncementForm({ ...announcementForm, audience: e.target.value })}
                      >
                        <option value="ALL">Усі</option>
                        <option value="STUDENTS">Студенти</option>
                        <option value="TEACHERS">Викладачі</option>
                        <option value="GROUP">Група</option>
                      </select>
                    </div>
                    {announcementForm.audience === 'GROUP' && (
                      <div className="form-group-field">
                        <label>Група</label>
                        <select
                          className="input-studevo-control"
                          value={announcementForm.groupId}
                          onChange={(e) => setAnnouncementForm({ ...announcementForm, groupId: e.target.value })}
                          required
                        >
                          <option value="">— оберіть —</option>
                          {academicGroups.map((group) => (
                            <option key={group.id} value={group.id}>
                              {group.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                  <div className="form-group-field">
                    <label>Текст</label>
                    <textarea
                      rows="3"
                      className="input-studevo-control"
                      value={announcementForm.body}
                      onChange={(e) => setAnnouncementForm({ ...announcementForm, body: e.target.value })}
                      required
                    />
                  </div>
                  <button type="submit" className="btn-studevo-primary">
                    Опублікувати
                  </button>
                </form>
              </div>
            )}

            <div className="studevo-card">
              {announcements.length === 0 ? (
                <p className="dash-empty">Оголошень немає.</p>
              ) : (
                announcements.map((item) => (
                  <div key={item.id} className="message-row">
                    <div className="message-head">
                      <strong>{item.title}</strong>
                      <span className="dash-hint">
                        {new Date(item.createdAt).toLocaleString('uk-UA', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className="dash-hint" style={{ marginBottom: '6px' }}>
                      {item.authorName} •{' '}
                      {item.audience === 'ALL'
                        ? 'усі'
                        : item.audience === 'STUDENTS'
                          ? 'студенти'
                          : item.audience === 'TEACHERS'
                            ? 'викладачі'
                            : academicGroups.find((g) => g.id === item.groupId)?.name || 'група'}
                    </div>
                    <div className="message-body">{item.body}</div>
                    {(userRole === 'admin' || item.authorId === currentUser?.id) && (
                      <button
                        type="button"
                        className="btn-studevo-outline"
                        style={{ marginTop: '8px', fontSize: '11.5px', padding: '4px 10px' }}
                        onClick={() => handleDeleteAnnouncement(item.id)}
                      >
                        Видалити
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* 9. PROFILE */}
        {activeMenu === 'profile' && (
          <div>
            <div className="section-header-row">
              <h2 className="section-title">Мій профіль</h2>
            </div>

            <div className="profile-layout">
              <section className="studevo-card profile-summary">
                <div className="profile-avatar">{currentUser.initials}</div>
                <div className="profile-name">{currentUser.name}</div>
                <span className="profile-role">
                  {userRole === 'student' ? 'Студент' : userRole === 'teacher' ? 'Викладач' : 'Деканат'}
                </span>
                <div className="profile-facts">
                  <div>
                    <span>Email</span>
                    <strong>{currentUser.email || '—'}</strong>
                  </div>
                  <div>
                    <span>Логін</span>
                    <strong>{currentUser.username || '—'}</strong>
                  </div>
                  <div>
                    <span>Підрозділ</span>
                    <strong>{currentUser.dept || '—'}</strong>
                  </div>
                  {userRole === 'student' && (
                    <div>
                      <span>Група</span>
                      <strong>{myGroup?.name || '—'}</strong>
                    </div>
                  )}
                </div>
              </section>

              <div className="profile-forms">
                <section className="studevo-card">
                  <h3 className="profile-section-title">Особисті дані</h3>
                  <form onSubmit={handleSaveProfile}>
                    <div className="profile-form-grid">
                      <div className="form-group-field">
                        <label>ПІБ</label>
                        <input
                          type="text"
                          className="input-studevo-control"
                          value={profileValues.fullName}
                          onChange={(e) => setProfileForm({ ...profileValues, fullName: e.target.value })}
                          required
                        />
                      </div>
                      <div className="form-group-field">
                        <label>Email</label>
                        <input
                          type="email"
                          className="input-studevo-control"
                          value={profileValues.email}
                          onChange={(e) => setProfileForm({ ...profileValues, email: e.target.value })}
                          required
                        />
                      </div>
                      <div className="form-group-field">
                        <label>Логін</label>
                        <input
                          type="text"
                          className="input-studevo-control"
                          value={profileValues.username}
                          onChange={(e) => setProfileForm({ ...profileValues, username: e.target.value })}
                          placeholder="латиниця, цифри, . _ -"
                        />
                      </div>
                      <div className="form-group-field">
                        <label>Кафедра / підрозділ</label>
                        <input
                          type="text"
                          className="input-studevo-control"
                          value={profileValues.department}
                          onChange={(e) => setProfileForm({ ...profileValues, department: e.target.value })}
                        />
                      </div>
                    </div>
                    <button type="submit" className="btn-studevo-primary">
                      Зберегти зміни
                    </button>
                  </form>
                </section>

                <section className="studevo-card">
                  <h3 className="profile-section-title">Зміна пароля</h3>
                  <form onSubmit={handleChangePassword}>
                    <div className="profile-form-grid">
                      <div className="form-group-field">
                        <label>Поточний пароль</label>
                        <input
                          type="password"
                          className="input-studevo-control"
                          value={passwordForm.current}
                          onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                          required
                        />
                      </div>
                      <div className="form-group-field">
                        <label>Новий пароль</label>
                        <input
                          type="password"
                          className="input-studevo-control"
                          value={passwordForm.next}
                          onChange={(e) => setPasswordForm({ ...passwordForm, next: e.target.value })}
                          minLength={6}
                          required
                        />
                      </div>
                      <div className="form-group-field">
                        <label>Повторіть новий пароль</label>
                        <input
                          type="password"
                          className="input-studevo-control"
                          value={passwordForm.repeat}
                          onChange={(e) => setPasswordForm({ ...passwordForm, repeat: e.target.value })}
                          minLength={6}
                          required
                        />
                      </div>
                    </div>
                    <button type="submit" className="btn-studevo-outline">
                      Змінити пароль
                    </button>
                  </form>
                </section>
              </div>
            </div>
          </div>
        )}

        {/* 9. MESSAGES (student / teacher / dean) */}
        {activeMenu === 'messages' && (
          <div>
            <div className="section-header-row">
              <h2 className="section-title">Повідомлення</h2>
              <span className="dash-hint">Непрочитаних: {unreadMessages}</span>
            </div>

            <div className="studevo-card" style={{ marginBottom: '20px' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', color: 'var(--studevo-red-dark)' }}>
                Нове повідомлення
              </h3>
              <form onSubmit={handleSendMessage}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.6fr', gap: '12px' }}>
                  <div className="form-group-field">
                    <label>Отримувач</label>
                    <select
                      className="input-studevo-control"
                      value={composeForm.recipientId}
                      onChange={(e) => setComposeForm({ ...composeForm, recipientId: e.target.value })}
                      required
                    >
                      <option value="">— оберіть —</option>
                      {directory
                        .filter((user) => user.id !== currentUser?.id)
                        .map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.fullName} (
                            {user.role === 'STUDENT'
                              ? 'студент'
                              : user.role === 'TEACHER'
                                ? 'викладач'
                                : 'деканат'}
                            )
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="form-group-field">
                    <label>Тема</label>
                    <input
                      type="text"
                      className="input-studevo-control"
                      value={composeForm.subject}
                      onChange={(e) => setComposeForm({ ...composeForm, subject: e.target.value })}
                      placeholder="Коротко про що повідомлення"
                    />
                  </div>
                </div>
                <div className="form-group-field">
                  <label>Текст повідомлення</label>
                  <textarea
                    rows="3"
                    className="input-studevo-control"
                    value={composeForm.body}
                    onChange={(e) => setComposeForm({ ...composeForm, body: e.target.value })}
                    required
                  />
                </div>
                <button type="submit" className="btn-studevo-primary">
                  Надіслати
                </button>
              </form>
            </div>

            <div className="studevo-card messenger-card">
              <div className="messenger-toolbar">
                <div>
                  <strong>Діалоги</strong>
                  <span className="dash-hint" style={{ marginLeft: '8px' }}>
                    {conversations.length} · непрочитаних {unreadMessages}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn-studevo-outline"
                  style={{ padding: '5px 12px', fontSize: '11.5px' }}
                  onClick={handleMarkAllRead}
                  disabled={unreadMessages === 0}
                >
                  Позначити всі прочитаними
                </button>
              </div>

              <div className="messenger">
                <aside className="messenger-list">
                  {conversations.length === 0 ? (
                    <p className="dash-empty" style={{ padding: '18px' }}>
                      Ще немає діалогів. Напишіть перше повідомлення вище.
                    </p>
                  ) : (
                    conversations.map((conversation) => (
                      <button
                        key={conversation.id}
                        type="button"
                        className={`conversation-item ${messagePeer?.id === conversation.id ? 'active' : ''}`}
                        onClick={() => handleOpenThread(conversation)}
                      >
                        <span className="conversation-avatar">{initialsOf(conversation.name)}</span>
                        <span className="conversation-main">
                          <span className="conversation-name">{conversation.name}</span>
                          <span className="conversation-last">{conversation.last}</span>
                        </span>
                        <span className="conversation-side">
                          {new Date(conversation.timestamp).toLocaleDateString('uk-UA', {
                            day: '2-digit',
                            month: '2-digit',
                          })}
                          {conversation.unread > 0 && (
                            <span className="conversation-badge">{conversation.unread}</span>
                          )}
                        </span>
                      </button>
                    ))
                  )}
                </aside>

                <section className="messenger-thread">
                  {!messagePeer ? (
                    <div className="messenger-empty">
                      <div className="messenger-empty-icon">✉</div>
                      <div>Оберіть діалог зі списку, щоб прочитати листування.</div>
                    </div>
                  ) : (
                    <>
                      <div className="thread-head">
                        <span className="conversation-avatar">{initialsOf(messagePeer.name)}</span>
                        <strong>{messagePeer.name}</strong>
                      </div>

                      <div className="thread-scroll">
                        {threadLoading ? (
                          <p className="dash-empty">Завантаження діалогу…</p>
                        ) : threadMessages.length === 0 ? (
                          <p className="dash-empty">Повідомлень у цьому діалозі ще немає.</p>
                        ) : (
                          threadMessages.map((message) => {
                            const mine = message.senderId === currentUser?.id;
                            return (
                              <div key={message.id} className={`chat-row ${mine ? 'mine' : 'theirs'}`}>
                                <div className={`chat-bubble ${mine ? 'mine' : 'theirs'}`}>
                                  {message.subject ? <div className="chat-subject">{message.subject}</div> : null}
                                  <div>{message.body}</div>
                                  <div className="chat-time">
                                    {new Date(message.createdAt).toLocaleString('uk-UA', {
                                      day: '2-digit',
                                      month: '2-digit',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      <form className="thread-compose" onSubmit={handleSendReply}>
                        <input
                          type="text"
                          className="input-studevo-control"
                          placeholder="Написати відповідь…"
                          value={replyBody}
                          onChange={(e) => setReplyBody(e.target.value)}
                          required
                        />
                        <button type="submit" className="btn-studevo-primary">
                          Надіслати
                        </button>
                      </form>
                    </>
                  )}
                </section>
              </div>
            </div>
          </div>
        )}

        {/* 8. ADMIN: SYSTEM ACTIVITY LOGS */}
        {activeMenu === 'audit' && userRole === 'admin' && (
          <div>
            <div className="section-header-row">
              <h2 className="section-title">Журнал подій системи</h2>
              <input
                type="text"
                className="input-studevo-control"
                style={{ width: '260px', padding: '6px 12px' }}
                placeholder="Пошук за користувачем або дією..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
              />
            </div>

            {auditStats && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
                {[
                  { label: 'Всього подій', value: auditStats.total, color: '#1864ab' },
                  { label: 'За 24 години', value: auditStats.last24h, color: '#2b8a3e' },
                  { label: 'Відмовлено', value: auditStats.denied, color: '#c92a2a' },
                  { label: 'Помилки', value: auditStats.errors, color: '#d9480f' },
                ].map((s) => (
                  <div key={s.label} className="studevo-card" style={{ padding: '14px 16px' }}>
                    <div style={{ fontSize: '11px', color: '#868e96', textTransform: 'uppercase' }}>{s.label}</div>
                    <div style={{ fontSize: '22px', fontWeight: 800, color: s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="studevo-card">
              <table className="studevo-table">
                <thead>
                  <tr>
                    <th>Час</th>
                    <th>Користувач</th>
                    <th>Дія</th>
                    <th>Розділ / Курс</th>
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAuditLogs.map((log) => (
                    <tr key={log.id}>
                      <td>{log.time}</td>
                      <td><strong>{log.userId}</strong></td>
                      <td>{log.action}</td>
                      <td style={{ color: '#495057' }}>{log.resource}</td>
                      <td>
                        {log.status === 'DENIED' ? (
                          <span className="badge-denied" style={{ background: '#ffe3e3', color: '#c92a2a', padding: '3px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 700 }}>
                            Відмовлено {log.statusCode ? `(${log.statusCode})` : ''}
                          </span>
                        ) : log.status === 'ERROR' ? (
                          <span style={{ background: '#fff4e6', color: '#d9480f', padding: '3px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 700 }}>
                            Помилка {log.statusCode ? `(${log.statusCode})` : ''}
                          </span>
                        ) : (
                          <span className="badge-allowed">Виконано</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredAuditLogs.length === 0 && (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', color: '#868e96', padding: '24px' }}>
                        Подій не знайдено
                      </td>
                    </tr>
                  )}
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
        <div className="organizer-widget">
          <div className="organizer-widget-header">
            <h3 className="organizer-widget-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <rect width="18" height="18" x="3" y="4" rx="2" ry="2"></rect>
                <line x1="16" x2="16" y1="2" y2="6"></line>
                <line x1="8" x2="8" y1="2" y2="6"></line>
                <line x1="3" x2="21" y1="10" y2="10"></line>
              </svg>
              <span>Навчальний календар</span>
            </h3>

            <div className="calendar-month-nav">
              <button type="button" className="calendar-nav-btn" onClick={handlePrevMonth} title="Попередній місяць">
                &lt;
              </button>
              <span>{UK_MONTHS[calMonth]} {calYear}</span>
              <button type="button" className="calendar-nav-btn" onClick={handleNextMonth} title="Наступний місяць">
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
            {calendarCells.map((day, idx) => {
              const dayEvents = day ? monthDeadlineMap[day] : null;
              const isToday = calYear === 2026 && calMonth === 9 && day === 16;
              return (
                <div
                  key={idx}
                  className={`cal-cell ${!day ? 'empty' : ''} ${dayEvents ? 'deadline-highlight' : ''} ${isToday ? 'today' : ''}`}
                  title={dayEvents ? dayEvents.map((e) => e.title).join(', ') : ''}
                  onClick={() => day && setSelectedCalDay(day === selectedCalDay ? null : day)}
                >
                  {day || ''}
                </div>
              );
            })}
          </div>

          {selectedCalDay && (
            <div style={{ marginTop: '10px', padding: '8px 10px', background: 'var(--studevo-red-light)', borderRadius: '8px', fontSize: '11.5px', border: '1px solid var(--studevo-accent-subtle)' }}>
              <strong>Події на {selectedCalDay} {UK_MONTHS[calMonth].toLowerCase()}:</strong>
              {monthDeadlineMap[selectedCalDay] ? (
                <ul style={{ margin: '4px 0 0 0', paddingLeft: '16px' }}>
                  {monthDeadlineMap[selectedCalDay].map((ev, i) => (
                    <li key={i}>{ev.title} ({ev.course})</li>
                  ))}
                </ul>
              ) : (
                <div style={{ color: '#6c757d', marginTop: '2px' }}>Подій на цей день немає.</div>
              )}
            </div>
          )}

          <div className="calendar-legend">
            <span className="legend-dot"></span>
            <span>Виділено дні здачі робіт та занять</span>
          </div>
        </div>

        {userRole === 'student' && (
          <div className="organizer-widget">
            <div className="organizer-widget-header">
              <h3 className="organizer-widget-title">
                <span>Найближчі дедлайни ({assignments.length})</span>
              </h3>
            </div>

            <div className="deadline-items-list">
              {assignments.slice(0, 4).map((asg) => {
                const isSubmitted = (asg.submissions || []).length > 0;
                return (
                  <div
                    key={asg.id}
                    className="deadline-card-item"
                    style={{ cursor: 'pointer' }}
                    onClick={() => setActiveMenu('assignments')}
                  >
                    <div className="deadline-card-info">
                      <div className="deadline-title">{asg.title}</div>
                      <div className="deadline-course">{asg.courseTitle} • {asg.maxScore} балів</div>
                      <span
                        className="deadline-countdown-badge"
                        style={{
                          backgroundColor: isSubmitted ? '#ebfbee' : '#ffe3e3',
                          color: isSubmitted ? '#2b8a3e' : 'var(--studevo-red-dark)',
                        }}
                      >
                        {isSubmitted
                          ? 'Роботу здано'
                          : `до ${new Date(asg.deadline).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' })}`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {userRole === 'teacher' && (
          <div className="organizer-widget">
            <div className="organizer-widget-header">
              <h3 className="organizer-widget-title">
                <span>Роботи на перевірку ({allSubmissionsList.length})</span>
              </h3>
            </div>

            <div className="deadline-items-list">
              {allSubmissionsList.map((sub) => (
                <div
                  key={sub.id}
                  className="deadline-card-item"
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    handleSelectSubmissionForGrading(sub.id);
                    setActiveMenu('grades');
                  }}
                >
                  <div className="deadline-card-info">
                    <div className="deadline-title">{sub.studentName} ({sub.group})</div>
                    <div className="deadline-course">{sub.assignmentTitle}</div>
                    <span
                      className="deadline-countdown-badge"
                      style={{
                        backgroundColor: sub.status === 'GRADED' ? '#ebfbee' : sub.isLate ? '#fff4e6' : '#e7f5ff',
                        color: sub.status === 'GRADED' ? '#2b8a3e' : sub.isLate ? '#d9480f' : '#1864ab',
                      }}
                    >
                      {sub.status === 'GRADED'
                        ? `Оцінено (${sub.score} б.)`
                        : sub.isLate
                          ? 'Після дедлайну'
                          : 'Перейти до перевірки'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {userRole === 'admin' && (
          <div className="organizer-widget">
            <div className="organizer-widget-header">
              <h3 className="organizer-widget-title">
                <span>Зведення по групах</span>
              </h3>
            </div>

            {academicGroups.map((g) => (
              <div key={g.id} className="infra-status-row">
                <span><strong>{g.name}</strong> ({g.studyYear} курс)</span>
                <span style={{ color: '#495057' }}>{g.studentsCount} студ.</span>
              </div>
            ))}
          </div>
        )}

        <div className="organizer-widget">
          <div className="organizer-widget-header">
            <h3 className="organizer-widget-title">
              <span>Останні оновлення</span>
            </h3>
          </div>

          <div className="updates-list">
            {eventsFeed.slice(0, 4).map((ev) => (
              <div key={ev.id} className="update-card-item">
                <div className={`update-icon-wrap ${ev.type === 'grade' ? 'grade' : 'course'}`}>
                  {ev.type === 'grade' ? '✓' : '★'}
                </div>
                <div className="update-content">
                  <div className="update-header-text">{ev.title}</div>
                  <div className="update-desc-text">{ev.desc}</div>
                  <div className="update-time">{ev.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* ========================================================
          MODAL 1: COURSE DETAILS, LESSONS & BUILDER
          ======================================================== */}
      {editingUser && (
        <div className="modal-overlay" onClick={() => setEditingUser(null)}>
          <div className="modal-window user-edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Редагування користувача</h3>
                <div className="course-view-header-sub">{editingUser.email}</div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setEditingUser(null)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveUser}>
              <div className="modal-body">
                <div className="profile-form-grid">
                  <div className="form-group-field">
                    <label>ПІБ</label>
                    <input
                      type="text"
                      className="input-studevo-control"
                      value={editUserForm.fullName}
                      onChange={(e) => setEditUserForm({ ...editUserForm, fullName: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group-field">
                    <label>Email</label>
                    <input
                      type="email"
                      className="input-studevo-control"
                      value={editUserForm.email}
                      onChange={(e) => setEditUserForm({ ...editUserForm, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group-field">
                    <label>Логін</label>
                    <input
                      type="text"
                      className="input-studevo-control"
                      value={editUserForm.username}
                      onChange={(e) => setEditUserForm({ ...editUserForm, username: e.target.value })}
                    />
                  </div>
                  <div className="form-group-field">
                    <label>Кафедра / підрозділ</label>
                    <input
                      type="text"
                      className="input-studevo-control"
                      value={editUserForm.department}
                      onChange={(e) => setEditUserForm({ ...editUserForm, department: e.target.value })}
                    />
                  </div>
                  <div className="form-group-field">
                    <label>Роль</label>
                    <select
                      className="input-studevo-control"
                      value={editUserForm.role}
                      onChange={(e) => setEditUserForm({ ...editUserForm, role: e.target.value })}
                    >
                      <option value="STUDENT">Студент</option>
                      <option value="TEACHER">Викладач</option>
                      <option value="ADMIN">Деканат</option>
                    </select>
                  </div>
                  <div className="form-group-field">
                    <label>Статус</label>
                    <select
                      className="input-studevo-control"
                      value={editUserForm.status}
                      onChange={(e) => setEditUserForm({ ...editUserForm, status: e.target.value })}
                    >
                      <option value="ACTIVE">Активний</option>
                      <option value="EXPELLED">Відрахований</option>
                      <option value="ACADEMIC_LEAVE">Академвідпустка</option>
                    </select>
                  </div>
                </div>
                <div className="form-group-field">
                  <label>Новий пароль (необов’язково)</label>
                  <input
                    type="text"
                    className="input-studevo-control"
                    value={editUserForm.password}
                    onChange={(e) => setEditUserForm({ ...editUserForm, password: e.target.value })}
                    placeholder="Залиште порожнім, щоб не змінювати"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-studevo-secondary" onClick={() => setEditingUser(null)}>
                  Скасувати
                </button>
                <button type="submit" className="btn-studevo-primary">
                  Зберегти
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedCourse && (
        <div className="modal-overlay" onClick={() => setSelectedCourseId(null)}>
          <div className="modal-window modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header course-view-header">
              <div>
                <h3>{selectedCourse.title}</h3>
                <div className="course-view-header-sub">
                  Навчальна дисципліна · Семестр {selectedCourse.semester}
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setSelectedCourseId(null)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="course-view-hero">
                <div className="course-view-cover">
                  <img src={selectedCourse.cover} alt={selectedCourse.title} />
                </div>
                <div className="course-view-info">
                  <div className="course-view-instructor">{selectedCourse.instructor}</div>
                  <div className="course-view-meta">
                    <span className="meta-chip">Семестр {selectedCourse.semester}</span>
                    <span className="meta-chip">{modulesLabel(selectedCourse.modules?.length || 0)}</span>
                    <span className="meta-chip">{selectedCourse.totalHours} годин</span>
                  </div>
                  <div className="course-view-status-row">
                    <span className={`dash-status ${selectedCourse.isPublished ? 'done' : 'pending'}`}>
                      {selectedCourse.isPublished ? 'Опубліковано' : 'Чернетка'}
                    </span>
                    <span className="course-progress-label">Прогрес {selectedCourse.progress}%</span>
                  </div>
                  <div className="course-progress-track">
                    <span style={{ width: `${selectedCourse.progress}%` }} />
                  </div>
                </div>
              </div>

              <p className="course-view-description">{selectedCourse.description}</p>

              <div className="course-view-section-head">
                <h4>Змістові модулі та навчальні матеріали</h4>
                <span className="dash-hint">
                  {materialCountLabel(
                    selectedCourse.modules?.reduce((sum, module) => sum + (module.lessons?.length || 0), 0) || 0
                  )}
                </span>
              </div>

              {selectedCourse.modules && selectedCourse.modules.length > 0 ? (
                selectedCourse.modules.map((m, moduleIndex) => (
                  <div key={m.id} className="course-module-card">
                    <div className="course-module-head">
                      <span className="course-module-index">{moduleIndex + 1}</span>
                      <span className="course-module-title">{m.title}</span>
                      <span className="course-module-count">{materialCountLabel(m.lessons?.length || 0)}</span>
                    </div>
                    {m.lessons && m.lessons.length > 0 ? (
                      m.lessons.map((l) => {
                        const isSelected = activeLessonId === l.id;
                        return (
                          <div key={l.id}>
                            <div
                              className={`lesson-item-row ${isSelected ? 'active-lesson' : ''}`}
                              onClick={() => setActiveLessonId(isSelected ? null : l.id)}
                            >
                              <div className="lesson-main">
                                <span className={`lesson-status-dot ${l.completed ? 'is-done' : ''}`}>
                                  {l.completed ? '✓' : ''}
                                </span>
                                <span className="lesson-title">{l.title}</span>
                                <span className="lesson-type-badge">{l.type}</span>
                              </div>

                              <div className="lesson-actions">
                                {userRole === 'teacher' && (
                                  <button
                                    type="button"
                                    className="btn-studevo-outline"
                                    style={{ padding: '4px 10px', fontSize: '11px' }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingLesson({ ...l, file: null });
                                    }}
                                  >
                                    Редагувати
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className={l.completed ? 'btn-studevo-secondary' : 'btn-studevo-outline'}
                                  style={{ padding: '4px 10px', fontSize: '11px' }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleLessonCompleted(selectedCourse.id, l.id);
                                  }}
                                >
                                  {l.completed ? 'Пройдено' : 'Відмітити'}
                                </button>
                              </div>
                            </div>

                            {editingLesson?.id === l.id ? (
                              <form className="lesson-edit-form" onSubmit={handleUpdateLesson}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '8px', marginBottom: '8px' }}>
                                  <input
                                    type="text"
                                    className="input-studevo-control"
                                    value={editingLesson.title}
                                    onChange={(e) => setEditingLesson({ ...editingLesson, title: e.target.value })}
                                    required
                                  />
                                  <select
                                    className="input-studevo-control"
                                    value={editingLesson.type}
                                    onChange={(e) => setEditingLesson({ ...editingLesson, type: e.target.value })}
                                  >
                                    <option value="Лекція">Лекція</option>
                                    <option value="Відео">Відео</option>
                                    <option value="Методичка">Методичка</option>
                                    <option value="Презентація">Презентація</option>
                                  </select>
                                </div>
                                <textarea
                                  rows="3"
                                  className="input-studevo-control"
                                  style={{ marginBottom: '8px' }}
                                  value={editingLesson.content || ''}
                                  onChange={(e) => setEditingLesson({ ...editingLesson, content: e.target.value })}
                                />
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                                  <input
                                    type="url"
                                    className="input-studevo-control"
                                    placeholder="Посилання на матеріал"
                                    value={editingLesson.linkUrl || ''}
                                    onChange={(e) => setEditingLesson({ ...editingLesson, linkUrl: e.target.value })}
                                  />
                                  <input
                                    type="url"
                                    className="input-studevo-control"
                                    placeholder="Посилання на відео"
                                    value={editingLesson.videoUrl || ''}
                                    onChange={(e) => setEditingLesson({ ...editingLesson, videoUrl: e.target.value })}
                                  />
                                </div>
                                <label className="file-dropzone-box" style={{ marginBottom: '8px' }}>
                                  <span style={{ fontSize: '11.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {editingLesson.file
                                      ? editingLesson.file.name
                                      : l.fileName
                                        ? `Поточний файл: ${l.fileName} (оберіть новий для заміни)`
                                        : 'Файл не прикріплено'}
                                  </span>
                                  <span className="btn-studevo-outline" style={{ padding: '3px 8px', fontSize: '11px' }}>
                                    Обрати файл
                                  </span>
                                  <input
                                    type="file"
                                    accept=".pdf,.doc,.docx,.ppt,.pptx,.zip,.txt,.md,.mp4,.webm,.png,.jpg,.jpeg"
                                    style={{ display: 'none' }}
                                    onChange={(e) =>
                                      setEditingLesson({ ...editingLesson, file: e.target.files?.[0] || null })
                                    }
                                  />
                                </label>
                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                  <button type="button" className="btn-studevo-secondary" onClick={() => setEditingLesson(null)}>
                                    Скасувати
                                  </button>
                                  <button type="submit" className="btn-studevo-primary">
                                    Зберегти зміни
                                  </button>
                                </div>
                              </form>
                            ) : isSelected && (
                              <div className="lesson-viewer-box">
                                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--studevo-red-dark)', marginBottom: '6px', textTransform: 'uppercase' }}>
                                  {l.type}:
                                </div>
                                <p style={{ margin: '0 0 10px 0', fontSize: '13px', lineHeight: 1.55, color: '#212529' }}>
                                  {l.content || 'Конспект лекції та додаткові матеріали до теми модуля.'}
                                </p>
                                {(l.videoUrl || l.linkUrl || l.hasFile) && (
                                  <div className="lesson-materials">
                                    {l.videoUrl && (
                                      <a href={l.videoUrl} target="_blank" rel="noreferrer">
                                        Відео
                                      </a>
                                    )}
                                    {l.linkUrl && (
                                      <a href={l.linkUrl} target="_blank" rel="noreferrer">
                                        Посилання на матеріал
                                      </a>
                                    )}
                                    {l.hasFile && (
                                      <button
                                        type="button"
                                        className="btn-studevo-outline"
                                        style={{ padding: '4px 10px', fontSize: '11.5px' }}
                                        onClick={() => handleDownloadLesson(l)}
                                      >
                                        Завантажити {l.fileName || 'файл'}
                                        {l.fileSize ? ` (${l.fileSize})` : ''}
                                      </button>
                                    )}
                                  </div>
                                )}
                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                  <button
                                    type="button"
                                    className="btn-studevo-primary"
                                    style={{ padding: '4px 12px', fontSize: '11.5px' }}
                                    onClick={() => handleToggleLessonCompleted(selectedCourse.id, l.id)}
                                  >
                                    {l.completed ? 'Скасувати відмітку' : 'Завершити урок'}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div style={{ fontSize: '12px', color: '#868e96' }}>У цьому модулі ще немає матеріалів.</div>
                    )}
                  </div>
                ))
              ) : (
                <p style={{ color: '#6c757d', fontSize: '12.5px' }}>Модулі наповнюються викладачем.</p>
              )}

              {userRole === 'teacher' && (
                <div className="course-teacher-tools">
                  <form onSubmit={handleAddModuleToCourse} className="course-add-panel">
                    <div className="course-add-title">
                      Додати змістовий модуль
                    </div>
                    <div className="form-group-field">
                      <input
                        type="text"
                        className="input-studevo-control"
                        placeholder="Назва модуля..."
                        value={newModuleTitle}
                        onChange={(e) => setNewModuleTitle(e.target.value)}
                        required
                      />
                    </div>
                    <button type="submit" className="btn-studevo-outline" style={{ width: '100%' }}>
                      Додати модуль
                    </button>
                  </form>

                  <form onSubmit={handleAddLessonToModule} className="course-add-panel muted">
                    <div className="course-add-title muted">
                      Додати матеріал у модуль
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                      <select
                        className="input-studevo-control"
                        value={newLessonForm.moduleId || selectedCourse.modules?.[0]?.id || ''}
                        onChange={(e) => setNewLessonForm({ ...newLessonForm, moduleId: e.target.value })}
                      >
                        {(selectedCourse.modules || []).map((m) => (
                          <option key={m.id} value={m.id}>{m.title}</option>
                        ))}
                      </select>
                      <select
                        className="input-studevo-control"
                        value={newLessonForm.type}
                        onChange={(e) => setNewLessonForm({ ...newLessonForm, type: e.target.value })}
                      >
                        <option value="Лекція">Лекція</option>
                        <option value="Відео">Відео</option>
                        <option value="Методичка">Методичка</option>
                        <option value="Презентація">Презентація</option>
                      </select>
                    </div>
                    <input
                      type="text"
                      className="input-studevo-control"
                      style={{ marginBottom: '8px' }}
                      placeholder="Назва уроку або методичних вказівок..."
                      value={newLessonForm.title}
                      onChange={(e) => setNewLessonForm({ ...newLessonForm, title: e.target.value })}
                      required
                    />
                    <textarea
                      rows="2"
                      className="input-studevo-control"
                      style={{ marginBottom: '8px' }}
                      placeholder="Текст лекції або опис матеріалу..."
                      value={newLessonForm.content}
                      onChange={(e) => setNewLessonForm({ ...newLessonForm, content: e.target.value })}
                    />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                      <input
                        type="url"
                        className="input-studevo-control"
                        placeholder="Посилання на матеріал (URL)"
                        value={newLessonForm.linkUrl}
                        onChange={(e) => setNewLessonForm({ ...newLessonForm, linkUrl: e.target.value })}
                      />
                      <input
                        type="url"
                        className="input-studevo-control"
                        placeholder="Посилання на відео (YouTube/Drive)"
                        value={newLessonForm.videoUrl}
                        onChange={(e) => setNewLessonForm({ ...newLessonForm, videoUrl: e.target.value })}
                      />
                    </div>
                    <label className="file-dropzone-box" style={{ marginBottom: '8px' }}>
                      <span style={{ fontSize: '11.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {newLessonForm.file
                          ? newLessonForm.file.name
                          : 'Файл: PDF, Word, PPT, ZIP, відео (до 60 МБ)'}
                      </span>
                      <span className="btn-studevo-outline" style={{ padding: '3px 8px', fontSize: '11px' }}>
                        Обрати
                      </span>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.ppt,.pptx,.zip,.txt,.md,.mp4,.webm,.png,.jpg,.jpeg"
                        style={{ display: 'none' }}
                        onChange={(e) =>
                          setNewLessonForm({ ...newLessonForm, file: e.target.files?.[0] || null })
                        }
                      />
                    </label>
                    <button type="submit" className="btn-studevo-primary" style={{ width: '100%' }}>
                      Зберегти матеріал
                    </button>
                  </form>
                </div>
              )}
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
                onClick={() => setSelectedCourseId(null)}
              >
                Закрити
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 2: ADMIN GROUP MANAGEMENT
          ======================================================== */}
      {managingGroup && (
        <div className="modal-overlay" onClick={() => setManagingGroupId(null)}>
          <div className="modal-window" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Група «{managingGroup.name}» — Дисципліни та студенти</h3>
              <button
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }}
                onClick={() => setManagingGroupId(null)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: 'var(--studevo-red-dark)' }}>
                1. Семестрові дисципліни групи:
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                {courses.map((c) => {
                  const isAssigned = (managingGroup.assignedCourseIds || []).includes(c.id);
                  return (
                    <div
                      key={c.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid #dee2e6',
                        background: isAssigned ? 'var(--studevo-red-light)' : '#ffffff',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '13px' }}>{c.title}</div>
                        <div style={{ fontSize: '11.5px', color: '#6c757d' }}>{c.instructor} • Семестр {c.semester}</div>
                      </div>
                      <button
                        type="button"
                        className={isAssigned ? 'btn-studevo-secondary' : 'btn-studevo-primary'}
                        style={{ padding: '5px 12px', fontSize: '12px' }}
                        onClick={() => handleToggleCourseForGroup(managingGroup.id, c.id)}
                      >
                        {isAssigned ? 'Відкріпити' : 'Призначити групі'}
                      </button>
                    </div>
                  );
                })}
              </div>

              <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: 'var(--studevo-red-dark)' }}>
                2. Студенти групи ({managingGroup.studentsCount} осіб):
              </h4>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
                {(managingGroup.studentsList || []).map((st, idx) => (
                  <span
                    key={idx}
                    style={{
                      background: '#f1f3f5',
                      padding: '4px 10px',
                      borderRadius: '14px',
                      fontSize: '12px',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span>{st}</span>
                    {userRole === 'admin' && (
                      <button
                        type="button"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#fa5252',
                          cursor: 'pointer',
                          fontWeight: 700,
                          fontSize: '13px',
                          padding: '0 2px',
                          lineHeight: 1,
                        }}
                        title={`Вилучити ${st} зі списку групи`}
                        onClick={() => handleRemoveStudentFromGroup(st)}
                      >
                        ✕
                      </button>
                    )}
                  </span>
                ))}
              </div>

              <form onSubmit={handleAddStudentToGroup} style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  className="input-studevo-control"
                  placeholder="ПІБ нового студента..."
                  value={newStudentNameInGroup}
                  onChange={(e) => setNewStudentNameInGroup(e.target.value)}
                  required
                />
                <button type="submit" className="btn-studevo-primary" style={{ whiteSpace: 'nowrap' }}>
                  + Додати студента
                </button>
              </form>

              <div style={{ marginTop: '18px', paddingTop: '16px', borderTop: '1px dashed #dee2e6' }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: 'var(--studevo-red-dark)' }}>
                  3. Зарахування користувача (user ↔ group)
                </h4>
                <div style={{ fontSize: '12px', color: '#6c757d', marginBottom: '10px' }}>
                  Зараховано ID:{' '}
                  <strong>{(managingGroup.enrolledUserIds || []).join(', ') || '—'}</strong>
                </div>
                <form onSubmit={handleEnrollStudent} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    list="studevo-users"
                    className="input-studevo-control"
                    style={{ flex: '1 1 180px' }}
                    placeholder="ID користувача"
                    value={enrollUserId}
                    onChange={(e) => setEnrollUserId(e.target.value)}
                    required
                  />
                  <datalist id="studevo-users">
                    {systemUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName} — {u.role}
                      </option>
                    ))}
                  </datalist>
                  <input
                    type="text"
                    className="input-studevo-control"
                    style={{ flex: '1 1 160px' }}
                    placeholder="ПІБ (необов'язково)"
                    value={enrollName}
                    onChange={(e) => setEnrollName(e.target.value)}
                  />
                  <button type="submit" className="btn-studevo-primary" style={{ whiteSpace: 'nowrap' }}>
                    Зарахувати
                  </button>
                </form>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-studevo-secondary" onClick={() => setManagingGroupId(null)}>
                Готово
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
