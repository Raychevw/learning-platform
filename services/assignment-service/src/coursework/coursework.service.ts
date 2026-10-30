import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { AssignmentEntity, RubricCriterion } from '../infrastructure/database/entities/AssignmentEntity.js';
import { StudentEntity } from '../infrastructure/database/entities/StudentEntity.js';
import {
  SubmissionEntity,
  GradeEntity,
  AcademicGroupEntity,
  EnrollmentEntity,
} from '../infrastructure/database/entities/CourseworkEntities.js';
import { GradeAssignmentUseCase } from '../application/assignment/GradeAssignmentUseCase.js';
import { STORAGE_SERVICE_TOKEN } from '../infrastructure/storage/storage.service.js';
import type { IStorageService } from '../infrastructure/storage/storage.service.js';
import { formatFileSize, safeFileName } from './upload.config.js';
import { validateCriteriaScores, resolveRule, describeRule } from './grading-policy.js';
import type { GradingRule } from './grading-policy.js';

export const newId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Minimal viewer descriptor used for row-level access filtering. */
export interface Viewer {
  userId: string;
  role: string;
  name?: string;
}

export interface UploadedArtifact {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

const DEFAULT_CRITERIA: RubricCriterion[] = [
  { id: 'clean_arch', name: 'Архітектура та якість коду', max: 40 },
  { id: 'patterns', name: 'Повнота реалізації завдання', max: 35 },
  { id: 'tests', name: 'Тестування та оформлення звіту', max: 25 },
];

const allowLateSubmissions = () => (process.env.ALLOW_LATE_SUBMISSION ?? 'true') !== 'false';

@Injectable()
export class CourseworkService {
  constructor(
    @InjectRepository(AssignmentEntity) private readonly assignments: Repository<AssignmentEntity>,
    @InjectRepository(StudentEntity) private readonly students: Repository<StudentEntity>,
    @InjectRepository(SubmissionEntity) private readonly submissions: Repository<SubmissionEntity>,
    @InjectRepository(GradeEntity) private readonly grades: Repository<GradeEntity>,
    @InjectRepository(AcademicGroupEntity) private readonly groups: Repository<AcademicGroupEntity>,
    @InjectRepository(EnrollmentEntity) private readonly enrollments: Repository<EnrollmentEntity>,
    private readonly gradeUseCase: GradeAssignmentUseCase,
    private readonly dataSource: DataSource,
    @Inject(STORAGE_SERVICE_TOKEN) private readonly storage: IStorageService,
  ) {}

  // ---------------------------------------------------------------- assignments
  async listAssignments(viewer?: Viewer) {
    const list = await this.assignments.find({ order: { createdAt: 'ASC' } });
    if (list.length === 0) return [];

    const subs = await this.submissions.find({
      where: { assignmentId: In(list.map((a) => a.id)) },
      order: { submittedAt: 'DESC' },
    });

    // Students receive only their own submissions (no access to classmates' work).
    const visibleSubs = viewer?.role === 'STUDENT' ? subs.filter((s) => s.studentId === viewer.userId) : subs;

    return list.map((a) => {
      const aSubs = visibleSubs.filter((s) => s.assignmentId === a.id);
      return {
        id: a.id,
        courseId: a.courseId,
        courseTitle: a.courseTitle,
        title: a.title,
        description: a.description,
        type: a.type,
        openAt: a.openAt instanceof Date ? a.openAt.toISOString() : a.openAt,
        deadline: a.dueDate instanceof Date ? a.dueDate.toISOString() : a.dueDate,
        allowedFormats: a.allowedFormats || ['pdf', 'docx'],
        maxScore: a.maxScore,
        rubricTitle: a.rubricTitle,
        criteria: a.criteria || [],
        submissions: aSubs.map((s) => this.toSubmissionDto(s)),
      };
    });
  }

  async createAssignment(dto: {
    courseId: string;
    courseTitle?: string;
    title: string;
    description?: string;
    type?: string;
    openAt?: string;
    deadline: string;
    allowedFormats?: string[];
    maxScore?: number;
    rubricTitle?: string;
    criteria?: RubricCriterion[];
  }) {
    if (!dto.title || !dto.title.trim()) throw new BadRequestException('Title cannot be empty');
    if (!dto.courseId) throw new BadRequestException('CourseId is required');

    const dueDate = new Date(dto.deadline);
    if (Number.isNaN(dueDate.getTime())) throw new BadRequestException('Некоректна дата дедлайну');

    let openAt: Date | null = null;
    if (dto.openAt) {
      openAt = new Date(dto.openAt);
      if (Number.isNaN(openAt.getTime())) throw new BadRequestException('Некоректна дата відкриття');
      if (openAt.getTime() >= dueDate.getTime()) {
        throw new BadRequestException('Дата відкриття має бути раніше за дедлайн');
      }
    }

    const allowedFormats = (dto.allowedFormats?.length ? dto.allowedFormats : ['pdf', 'docx'])
      .map((format) => format.toLowerCase().replace(/^\./, '').trim())
      .filter(Boolean);

    const criteria = this.normalizeCriteria(dto.criteria);
    const totalMax = criteria.reduce((sum, c) => sum + (Number(c.max) || 0), 0);

    const asg = this.assignments.create({
      id: newId('asg'),
      courseId: dto.courseId,
      courseTitle: dto.courseTitle || 'Курс',
      title: dto.title.trim(),
      description: (dto.description || '').trim(),
      type: dto.type || 'Лабораторна',
      openAt,
      dueDate,
      allowedFormats,
      maxScore: totalMax,
      rubricTitle: dto.rubricTitle || `Критерії оцінювання (${totalMax} балів)`,
      criteria,
      isCourseVerified: true,
    });
    await this.assignments.save(asg);
    return asg;
  }

  /** Рубрика должна быть непротиворечивой: уникальные id, положительные max. */
  private normalizeCriteria(input?: RubricCriterion[]): RubricCriterion[] {
    if (!input || input.length === 0) return DEFAULT_CRITERIA;
    const seen = new Set<string>();
    const result = input.map((c) => {
      const id = String(c.id || '').trim();
      const name = String(c.name || '').trim();
      const max = Number(c.max);
      if (!id || !name) throw new BadRequestException('Кожен критерій повинен мати id та назву');
      if (seen.has(id)) throw new BadRequestException(`Дубльований критерій: ${id}`);
      if (!Number.isFinite(max) || max <= 0 || max > 1000) {
        throw new BadRequestException(`Некоректна максимальна оцінка для критерію "${name}"`);
      }
      seen.add(id);
      return { id, name, max };
    });
    const total = result.reduce((sum, c) => sum + c.max, 0);
    if (total <= 0) throw new BadRequestException('Сума критеріїв повинна бути більшою за 0');
    return result;
  }

  // ---------------------------------------------------------------- submissions
  async submitAssignment(assignmentId: string, dto: { comment?: string; group?: string }, viewer: Viewer) {
    return this.persistSubmission(assignmentId, dto, viewer, null);
  }

  async submitAssignmentWithFile(
    assignmentId: string,
    dto: { comment?: string; group?: string },
    viewer: Viewer,
    file: UploadedArtifact,
  ) {
    if (!file || !file.buffer?.length) throw new BadRequestException('Файл не отримано');
    return this.persistSubmission(assignmentId, dto, viewer, file);
  }

  private async persistSubmission(
    assignmentId: string,
    dto: { comment?: string; group?: string },
    viewer: Viewer,
    file: UploadedArtifact | null,
  ) {
    const asg = await this.assignments.findOneBy({ id: assignmentId });
    if (!asg) throw new NotFoundException(`Assignment ${assignmentId} not found`);

    const now = new Date();
    const due = asg.dueDate instanceof Date ? asg.dueDate : new Date(asg.dueDate);
    const isLate = now.getTime() > due.getTime();

    if (asg.openAt) {
      const open = asg.openAt instanceof Date ? asg.openAt : new Date(asg.openAt);
      if (now.getTime() < open.getTime()) {
        throw new BadRequestException(
          `Завдання відкриється ${open.toLocaleString('uk-UA')}. Здача ще недоступна.`,
        );
      }
    }

    if (file) {
      const ext = (file.originalname.split('.').pop() || '').toLowerCase();
      const allowed = asg.allowedFormats?.length ? asg.allowedFormats : ['pdf', 'docx'];
      if (!allowed.includes(ext)) {
        throw new BadRequestException(`Дозволені формати відповіді: ${allowed.join(', ')}`);
      }
    }

    if (isLate && !allowLateSubmissions()) {
      throw new BadRequestException(
        `Дедлайн минув (${due.toLocaleString('uk-UA')}). Здача після дедлайну вимкнена.`,
      );
    }

    const existing = await this.submissions.findOneBy({ assignmentId, studentId: viewer.userId });
    const group = await this.resolveGroupName(viewer.userId, dto.group);
    const studentName = viewer.name || existing?.studentName || 'Студент';

    let storedKey: string | null = existing?.fileKey ?? null;
    let fileName = existing?.fileName ?? '';
    let fileSize = existing?.fileSize ?? '';
    let mimeType = existing?.mimeType ?? null;
    let newKey: string | null = null;

    if (file) {
      newKey = `submissions/${asg.id}/${viewer.userId}/${crypto.randomUUID()}-${safeFileName(file.originalname)}`;
      await this.storage.put(newKey, file.buffer, file.mimetype);
      storedKey = newKey;
      fileName = file.originalname;
      fileSize = formatFileSize(file.size);
      mimeType = file.mimetype;
    }

    const sub =
      existing ??
      this.submissions.create({
        id: newId('sub'),
        assignmentId,
        studentId: viewer.userId,
      });

    sub.studentName = studentName;
    sub.group = group;
    sub.fileName = fileName;
    sub.fileSize = fileSize;
    sub.fileKey = storedKey;
    sub.mimeType = mimeType;
    sub.isLate = isLate;
    sub.comment = (dto.comment || '').trim();
    sub.submittedAt = now;
    sub.status = 'READY_FOR_GRADING';
    sub.score = null;

    try {
      await this.submissions.save(sub);
    } catch (err) {
      // Не оставляем «сироту» в хранилище, если запись в БД не удалась.
      if (newKey) await this.storage.delete(newKey).catch(() => undefined);
      throw err;
    }

    // Новый файл заменил старый — чистим предыдущий артефакт.
    if (newKey && existing?.fileKey && existing.fileKey !== newKey) {
      await this.storage.delete(existing.fileKey).catch(() => undefined);
    }

    return this.toSubmissionDto(sub);
  }

  async getSubmissionFile(submissionId: string, viewer: Viewer) {
    const sub = await this.submissions.findOneBy({ id: submissionId });
    if (!sub) throw new NotFoundException('Здану роботу не знайдено');
    if (viewer.role === 'STUDENT' && sub.studentId !== viewer.userId) {
      throw new ForbiddenException('Доступ до файлу іншого студента заборонено');
    }
    if (!sub.fileKey) throw new NotFoundException('До цієї роботи не прикріплено файл');

    const stream: Readable = await this.storage.getStream(sub.fileKey);
    return {
      stream,
      fileName: sub.fileName || 'submission',
      mimeType: sub.mimeType || 'application/octet-stream',
      driver: this.storage.driver,
    };
  }

  // ---------------------------------------------------------------- grading (Strategy pattern)
  async gradeSubmission(
    dto: {
      submissionId: string;
      rule?: 'STANDARD' | 'LATE_PENALTY' | 'EXCELLENCE_BONUS';
      criteriaScores: Record<string, number>;
      feedback?: string;
      overrideLate?: boolean;
    },
    viewer: Viewer,
  ) {
    const sub = await this.submissions.findOneBy({ id: dto.submissionId });
    if (!sub) throw new NotFoundException(`Submission ${dto.submissionId} not found`);

    const asg = await this.assignments.findOneBy({ id: sub.assignmentId });
    if (!asg) throw new NotFoundException(`Assignment ${sub.assignmentId} not found`);

    const criteria = asg.criteria?.length ? asg.criteria : DEFAULT_CRITERIA;
    const scores = dto.criteriaScores || {};
    const rawScore = validateCriteriaScores(scores, criteria, asg.maxScore);

    // Автоматический штраф за просрочку, если преподаватель явно не выбрал правило.
    let rule: GradingRule = resolveRule(dto.rule, sub.isLate);
    if (dto.overrideLate && sub.isLate && !dto.rule) rule = 'STANDARD';

    const domainResult = await this.gradeUseCase.execute({
      assignmentId: asg.id,
      studentId: sub.studentId,
      rawScore,
      submittedAt: sub.submittedAt.toISOString(),
      strategyName: rule,
    });

    const finalScore = Math.min(asg.maxScore, Math.max(0, Math.round(domainResult.finalScore * 100) / 100));
    const ruleDesc = describeRule(rule, sub.isLate, asg.maxScore, finalScore);

    const saved = await this.dataSource.transaction(async (em) => {
      sub.status = 'GRADED';
      sub.score = finalScore;
      await em.save(SubmissionEntity, sub);

      let grade = await em.findOneBy(GradeEntity, { submissionId: sub.id });
      if (!grade) {
        grade = em.create(GradeEntity, {
          id: newId('grd'),
          assignmentId: asg.id,
          submissionId: sub.id,
          studentId: sub.studentId,
        });
      }
      grade.studentName = sub.studentName;
      grade.group = sub.group;
      grade.courseTitle = asg.courseTitle;
      grade.assignmentTitle = asg.title;
      grade.gradedAt = new Date();
      grade.rawScore = rawScore;
      grade.finalScore = finalScore;
      grade.maxScore = asg.maxScore;
      grade.rule = rule;
      grade.isLate = sub.isLate;
      grade.criteriaScores = scores;
      grade.feedback = dto.feedback || '';
      return em.save(GradeEntity, grade);
    });

    return {
      ...saved,
      ruleDesc,
      isLate: sub.isLate,
      criteria,
      gradedBy: viewer.userId,
    };
  }

  // ---------------------------------------------------------------- grades
  async listGrades(viewer?: Viewer) {
    const list = await this.grades.find({
      where: viewer?.role === 'STUDENT' ? { studentId: viewer.userId } : {},
      order: { gradedAt: 'DESC' },
    });
    return list.map((g) => ({
      id: g.id,
      assignmentId: g.assignmentId,
      submissionId: g.submissionId,
      studentId: g.studentId,
      studentName: g.studentName,
      group: g.group,
      courseTitle: g.courseTitle,
      assignmentTitle: g.assignmentTitle,
      submittedAt: g.gradedAt.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' }),
      rawScore: g.rawScore,
      finalScore: g.finalScore,
      maxScore: g.maxScore,
      rule: g.rule,
      ruleDesc: describeRule(g.rule, g.isLate, g.maxScore, g.finalScore),
      isLate: g.isLate,
      criteriaScores: g.criteriaScores,
      feedback: g.feedback,
    }));
  }

  // ---------------------------------------------------------------- academic groups
  async listGroups() {
    const groups = await this.groups.find({ order: { createdAt: 'ASC' } });
    const enrollments = await this.enrollments.find();
    return groups.map((g) => ({
      ...g,
      enrolledUserIds: enrollments.filter((e) => e.groupId === g.id).map((e) => e.userId),
    }));
  }

  async createGroup(dto: { name: string; faculty?: string; studyYear?: number }) {
    if (!dto.name || !dto.name.trim()) throw new BadRequestException('Group name is required');
    const group = this.groups.create({
      id: newId('g'),
      name: dto.name.trim(),
      faculty: dto.faculty || 'ФІОТ',
      studyYear: Number(dto.studyYear) || 1,
      studentsCount: 0,
      assignedCourseIds: ['c-1'],
      studentsList: [],
    });
    await this.groups.save(group);
    return group;
  }

  async toggleCourseForGroup(groupId: string, courseId: string) {
    const group = await this.groups.findOneBy({ id: groupId });
    if (!group) throw new NotFoundException(`Group ${groupId} not found`);

    const ids = group.assignedCourseIds || [];
    group.assignedCourseIds = ids.includes(courseId)
      ? ids.filter((id) => id !== courseId)
      : [...ids, courseId];

    await this.groups.save(group);
    return group;
  }

  async addStudentToGroup(groupId: string, studentName: string) {
    if (!studentName || !studentName.trim()) throw new BadRequestException('Student name is required');
    const group = await this.groups.findOneBy({ id: groupId });
    if (!group) throw new NotFoundException(`Group ${groupId} not found`);

    group.studentsList = [...(group.studentsList || []), studentName.trim()];
    group.studentsCount = (group.studentsCount || 0) + 1;
    await this.groups.save(group);
    return group;
  }

  async removeStudentFromGroup(groupId: string, studentName: string) {
    const group = await this.groups.findOneBy({ id: groupId });
    if (!group) throw new NotFoundException(`Group ${groupId} not found`);

    group.studentsList = (group.studentsList || []).filter((s) => s !== studentName);
    group.studentsCount = Math.max(0, (group.studentsCount || 1) - 1);
    await this.groups.save(group);
    return group;
  }

  // ---------------------------------------------------------------- enrollments
  async listEnrollments() {
    const [enrollments, groups] = await Promise.all([
      this.enrollments.find({ order: { createdAt: 'ASC' } }),
      this.groups.find(),
    ]);
    return enrollments.map((e) => ({
      ...e,
      groupName: groups.find((g) => g.id === e.groupId)?.name || e.groupId,
    }));
  }

  /** Реальный ростер курса: только зачисленные пользователи (без выдуманных имён). */
  async listEnrollmentsForCourse(courseId: string) {
    if (!courseId) throw new BadRequestException('courseId is required');

    const groups = await this.groups.find();
    const courseGroupIds = groups
      .filter((g) => Array.isArray(g.assignedCourseIds) && g.assignedCourseIds.includes(courseId))
      .map((g) => g.id);
    if (courseGroupIds.length === 0) return [];

    const enrollments = await this.enrollments.find({
      where: { groupId: In(courseGroupIds) },
      order: { createdAt: 'ASC' },
    });

    const seen = new Set<string>();
    return enrollments
      .filter((e) => {
        if (seen.has(e.userId)) return false;
        seen.add(e.userId);
        return true;
      })
      .map((e) => ({
        userId: e.userId,
        studentName: e.studentName,
        groupId: e.groupId,
        groupName: groups.find((g) => g.id === e.groupId)?.name || '',
      }));
  }

  async enrollStudent(groupId: string, dto: { userId: string; studentName?: string }) {
    if (!dto.userId?.trim()) throw new BadRequestException('userId is required');
    const group = await this.groups.findOneBy({ id: groupId });
    if (!group) throw new NotFoundException(`Group ${groupId} not found`);

    let enrollment = await this.enrollments.findOneBy({ userId: dto.userId });
    if (!enrollment) {
      enrollment = this.enrollments.create({
        id: newId('enr'),
        userId: dto.userId,
        groupId,
        studentName: dto.studentName?.trim() || '',
      });
    } else {
      enrollment.groupId = groupId;
      if (dto.studentName?.trim()) enrollment.studentName = dto.studentName.trim();
    }
    await this.enrollments.save(enrollment);

    // Держим legacy-список имён в группе синхронным с зачислениями.
    if (enrollment.studentName && !(group.studentsList || []).includes(enrollment.studentName)) {
      group.studentsList = [...(group.studentsList || []), enrollment.studentName];
      group.studentsCount = group.studentsList.length;
      await this.groups.save(group);
    }
    return enrollment;
  }

  async unenrollStudent(groupId: string, userId: string) {
    const enrollment = await this.enrollments.findOneBy({ userId, groupId });
    if (!enrollment) throw new NotFoundException('Зарахування не знайдено');
    await this.enrollments.delete({ userId, groupId });

    const group = await this.groups.findOneBy({ id: groupId });
    if (group && enrollment.studentName) {
      group.studentsList = (group.studentsList || []).filter((n) => n !== enrollment.studentName);
      group.studentsCount = group.studentsList.length;
      await this.groups.save(group);
    }
    return { userId, groupId, unenrolled: true };
  }

  async resolveGroupName(userId: string, fallback?: string): Promise<string> {
    const enrollment = await this.enrollments.findOneBy({ userId });
    if (!enrollment) return fallback || '';
    const group = await this.groups.findOneBy({ id: enrollment.groupId });
    return group?.name || fallback || '';
  }

  // ---------------------------------------------------------------- analytics (dean)
  async analyticsOverview() {
    const [groups, enrollments, grades, submissions, assignments] = await Promise.all([
      this.groups.find({ order: { createdAt: 'ASC' } }),
      this.enrollments.find(),
      this.grades.find(),
      this.submissions.find(),
      this.assignments.find(),
    ]);

    const round = (value: number) => Math.round(value * 10) / 10;
    const numeric = (value: unknown) => Number(value) || 0;

    const studentIds = new Set<string>();
    enrollments.forEach((item) => studentIds.add(item.userId));
    grades.forEach((item) => studentIds.add(item.studentId));

    const debts = grades.filter((grade) => numeric(grade.finalScore) < 60);
    const ungraded = submissions.filter((submission) => submission.status !== 'GRADED');

    const studentNames = new Map<string, string>();
    const studentGroups = new Map<string, string>();
    enrollments.forEach((item) => {
      studentNames.set(item.userId, item.studentName);
      studentGroups.set(item.userId, item.groupId);
    });
    grades.forEach((item) => {
      if (!studentNames.has(item.studentId)) studentNames.set(item.studentId, item.studentName);
    });

    // Пропущені роботи: дедлайн минув, а сдачі немає.
    const now = Date.now();
    const missingByStudent = new Map<string, number>();
    const pastAssignments = assignments.filter((assignment) => {
      const due = assignment.dueDate instanceof Date ? assignment.dueDate : new Date(assignment.dueDate);
      return due.getTime() < now;
    });
    for (const assignment of pastAssignments) {
      for (const enrollment of enrollments) {
        const submitted = submissions.some(
          (submission) =>
            submission.assignmentId === assignment.id && submission.studentId === enrollment.userId,
        );
        if (!submitted) {
          missingByStudent.set(enrollment.userId, (missingByStudent.get(enrollment.userId) || 0) + 1);
        }
      }
    }

    const groupStats = groups.map((group) => {
      const userIds = new Set(
        enrollments.filter((item) => item.groupId === group.id).map((item) => item.userId),
      );
      const groupGrades = grades.filter((grade) => userIds.has(grade.studentId));
      const average = groupGrades.length
        ? round(groupGrades.reduce((sum, grade) => sum + numeric(grade.finalScore), 0) / groupGrades.length)
        : null;
      return {
        groupId: group.id,
        name: group.name,
        faculty: group.faculty,
        specialty: group.specialty,
        students: userIds.size,
        avgScore: average,
        debts: groupGrades.filter((grade) => numeric(grade.finalScore) < 60).length,
        graded: groupGrades.length,
      };
    });

    const courseAgg = new Map<string, { total: number; count: number; debts: number }>();
    for (const grade of grades) {
      const key = grade.courseTitle || 'Без дисципліни';
      const current = courseAgg.get(key) || { total: 0, count: 0, debts: 0 };
      current.total += numeric(grade.finalScore);
      current.count += 1;
      if (numeric(grade.finalScore) < 60) current.debts += 1;
      courseAgg.set(key, current);
    }

    const courseStats = Array.from(courseAgg.entries()).map(([courseTitle, value]) => ({
      courseTitle,
      avgScore: value.count ? round(value.total / value.count) : null,
      graded: value.count,
      debts: value.debts,
    }));

    const pendingByCourse = new Map<string, number>();
    for (const submission of ungraded) {
      const assignment = assignments.find((item) => item.id === submission.assignmentId);
      const key = assignment?.courseTitle || 'Без дисципліни';
      pendingByCourse.set(key, (pendingByCourse.get(key) || 0) + 1);
    }

    const riskIds = new Set<string>([
      ...debts.map((grade) => grade.studentId),
      ...Array.from(missingByStudent.keys()),
    ]);
    const riskStudents = Array.from(riskIds)
      .map((studentId) => {
        const studentGrades = grades.filter((grade) => grade.studentId === studentId);
        const average = studentGrades.length
          ? round(studentGrades.reduce((sum, grade) => sum + numeric(grade.finalScore), 0) / studentGrades.length)
          : null;
        const groupId = studentGroups.get(studentId);
        return {
          studentId,
          studentName: studentNames.get(studentId) || studentId,
          group: groups.find((group) => group.id === groupId)?.name || '',
          avgScore: average,
          debts: studentGrades.filter((grade) => numeric(grade.finalScore) < 60).length,
          missing: missingByStudent.get(studentId) || 0,
        };
      })
      .sort((a, b) => b.debts + b.missing - (a.debts + a.missing))
      .slice(0, 20);

    return {
      totals: {
        students: studentIds.size,
        groups: groups.length,
        grades: grades.length,
        debts: debts.length,
        ungraded: ungraded.length,
        assignments: assignments.length,
      },
      groupStats,
      courseStats,
      pendingByCourse: Array.from(pendingByCourse.entries()).map(([courseTitle, pending]) => ({
        courseTitle,
        pending,
      })),
      riskStudents,
      generatedAt: new Date().toISOString(),
    };
  }

  // ---------------------------------------------------------------- helpers
  private toSubmissionDto(s: SubmissionEntity) {
    return {
      id: s.id,
      studentId: s.studentId,
      studentName: s.studentName,
      group: s.group,
      submittedAt: s.submittedAt instanceof Date ? s.submittedAt.toISOString() : s.submittedAt,
      fileName: s.fileName,
      fileSize: s.fileSize,
      mimeType: s.mimeType,
      hasFile: Boolean(s.fileKey),
      downloadUrl: s.fileKey ? `/api/submissions/${s.id}/file` : null,
      isLate: s.isLate,
      comment: s.comment,
      status: s.status,
      score: s.score,
    };
  }
}
