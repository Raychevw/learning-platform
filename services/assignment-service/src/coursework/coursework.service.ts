import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AssignmentEntity } from '../infrastructure/database/entities/AssignmentEntity.js';
import { StudentEntity } from '../infrastructure/database/entities/StudentEntity.js';
import {
  SubmissionEntity,
  GradeEntity,
  AcademicGroupEntity,
} from '../infrastructure/database/entities/CourseworkEntities.js';
import { GradeAssignmentUseCase } from '../application/assignment/GradeAssignmentUseCase.js';

export const newId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

@Injectable()
export class CourseworkService {
  constructor(
    @InjectRepository(AssignmentEntity) private readonly assignments: Repository<AssignmentEntity>,
    @InjectRepository(StudentEntity) private readonly students: Repository<StudentEntity>,
    @InjectRepository(SubmissionEntity) private readonly submissions: Repository<SubmissionEntity>,
    @InjectRepository(GradeEntity) private readonly grades: Repository<GradeEntity>,
    @InjectRepository(AcademicGroupEntity) private readonly groups: Repository<AcademicGroupEntity>,
    private readonly gradeUseCase: GradeAssignmentUseCase,
  ) {}

  // ---------------------------------------------------------------- assignments
  async listAssignments() {
    const list = await this.assignments.find({ order: { createdAt: 'ASC' } });
    if (list.length === 0) return [];

    const subs = await this.submissions.find({
      where: { assignmentId: In(list.map((a) => a.id)) },
      order: { submittedAt: 'DESC' },
    });

    return list.map((a) => {
      const aSubs = subs.filter((s) => s.assignmentId === a.id);
      return {
        id: a.id,
        courseId: a.courseId,
        courseTitle: a.courseTitle,
        title: a.title,
        description: a.description,
        type: a.type,
        deadline: a.dueDate instanceof Date ? a.dueDate.toISOString() : a.dueDate,
        maxScore: a.maxScore,
        rubricTitle: a.rubricTitle,
        criteria: a.criteria || [],
        submissions: aSubs.map((s) => ({
          id: s.id,
          studentId: s.studentId,
          studentName: s.studentName,
          group: s.group,
          submittedAt: s.submittedAt instanceof Date ? s.submittedAt.toISOString() : s.submittedAt,
          fileName: s.fileName,
          fileSize: s.fileSize,
          comment: s.comment,
          status: s.status,
          score: s.score,
        })),
      };
    });
  }

  async createAssignment(dto: {
    courseId: string;
    courseTitle?: string;
    title: string;
    description?: string;
    type?: string;
    deadline: string;
    maxScore?: number;
    rubricTitle?: string;
    criteria?: Array<{ id: string; name: string; max: number }>;
  }) {
    if (!dto.title || !dto.title.trim()) throw new BadRequestException('Title cannot be empty');
    if (!dto.courseId) throw new BadRequestException('CourseId is required');

    const criteria = dto.criteria && dto.criteria.length ? dto.criteria : [
      { id: 'clean_arch', name: 'Архітектура та якість коду', max: 40 },
      { id: 'patterns', name: 'Повнота реалізації завдання', max: 35 },
      { id: 'tests', name: 'Тестування та оформлення звіту', max: 25 },
    ];
    const totalMax = criteria.reduce((sum, c) => sum + (Number(c.max) || 0), 0) || 100;

    const asg = this.assignments.create({
      id: newId('asg'),
      courseId: dto.courseId,
      courseTitle: dto.courseTitle || 'Курс',
      title: dto.title.trim(),
      description: (dto.description || '').trim(),
      type: dto.type || 'Лабораторна',
      dueDate: new Date(dto.deadline),
      maxScore: totalMax,
      rubricTitle: dto.rubricTitle || `Критерії оцінювання (${totalMax} балів)`,
      criteria,
      isCourseVerified: true,
    });
    await this.assignments.save(asg);
    return asg;
  }

  // ---------------------------------------------------------------- submissions
  async submitAssignment(assignmentId: string, dto: {
    studentId: string;
    studentName: string;
    group?: string;
    fileName?: string;
    fileSize?: string;
    comment?: string;
  }) {
    const asg = await this.assignments.findOneBy({ id: assignmentId });
    if (!asg) throw new NotFoundException(`Assignment ${assignmentId} not found`);

    let sub = await this.submissions.findOneBy({ assignmentId, studentId: dto.studentId });
    if (!sub) {
      sub = this.submissions.create({
        id: newId('sub'),
        assignmentId,
        studentId: dto.studentId,
        studentName: dto.studentName,
        group: dto.group || 'ІПЗ-412',
        fileName: dto.fileName || 'Звіт_Лабораторна.pdf',
        fileSize: dto.fileSize || '1.2 МБ',
        comment: (dto.comment || '').trim(),
        status: 'READY_FOR_GRADING',
        submittedAt: new Date(),
        score: null,
      });
    } else {
      sub.fileName = dto.fileName || sub.fileName;
      sub.fileSize = dto.fileSize || sub.fileSize;
      sub.comment = (dto.comment || '').trim();
      sub.submittedAt = new Date();
      sub.status = 'READY_FOR_GRADING';
    }
    await this.submissions.save(sub);
    return sub;
  }

  // ---------------------------------------------------------------- grading (Strategy pattern)
  async gradeSubmission(dto: {
    submissionId: string;
    rule: 'STANDARD' | 'LATE_PENALTY' | 'EXCELLENCE_BONUS';
    criteriaScores: Record<string, number>;
    feedback?: string;
  }) {
    const sub = await this.submissions.findOneBy({ id: dto.submissionId });
    if (!sub) throw new NotFoundException(`Submission ${dto.submissionId} not found`);

    const asg = await this.assignments.findOneBy({ id: sub.assignmentId });
    if (!asg) throw new NotFoundException(`Assignment ${sub.assignmentId} not found`);

    const rawScore = Object.values(dto.criteriaScores || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);

    // Call domain use case using Strategy Pattern
    const domainResult = await this.gradeUseCase.execute({
      assignmentId: asg.id,
      studentId: sub.studentId,
      rawScore,
      submittedAt: sub.submittedAt.toISOString(),
      strategyName: dto.rule,
    });

    sub.status = 'GRADED';
    sub.score = domainResult.finalScore;
    await this.submissions.save(sub);

    let ruleDesc = 'Стандартний розрахунок';
    if (dto.rule === 'LATE_PENALTY') ruleDesc = 'Зниження на 20% (пізня здача)';
    else if (dto.rule === 'EXCELLENCE_BONUS') ruleDesc = 'Заохочувальний бонус (+5 балів)';

    let grade = await this.grades.findOneBy({ submissionId: sub.id });
    if (!grade) {
      grade = this.grades.create({
        id: newId('grd'),
        assignmentId: asg.id,
        submissionId: sub.id,
        studentId: sub.studentId,
        studentName: sub.studentName,
        group: sub.group,
        courseTitle: asg.courseTitle,
        assignmentTitle: asg.title,
        gradedAt: new Date(),
        rawScore,
        finalScore: domainResult.finalScore,
        maxScore: asg.maxScore,
        rule: dto.rule,
        criteriaScores: dto.criteriaScores,
        feedback: dto.feedback || '',
      });
    } else {
      grade.rawScore = rawScore;
      grade.finalScore = domainResult.finalScore;
      grade.rule = dto.rule;
      grade.criteriaScores = dto.criteriaScores;
      grade.feedback = dto.feedback || '';
      grade.gradedAt = new Date();
    }
    await this.grades.save(grade);

    return {
      ...grade,
      ruleDesc,
    };
  }

  // ---------------------------------------------------------------- grades
  async listGrades() {
    const list = await this.grades.find({ order: { gradedAt: 'DESC' } });
    return list.map((g) => {
      let ruleDesc = 'Стандартний розрахунок';
      if (g.rule === 'LATE_PENALTY') ruleDesc = 'Зниження на 20% (пізня здача)';
      else if (g.rule === 'EXCELLENCE_BONUS') ruleDesc = 'Заохочувальний бонус (+5 балів)';
      return {
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
        ruleDesc,
        feedback: g.feedback,
      };
    });
  }

  // ---------------------------------------------------------------- academic groups
  async listGroups() {
    return this.groups.find({ order: { createdAt: 'ASC' } });
  }

  async createGroup(dto: { name: string; faculty?: string; studyYear?: number }) {
    if (!dto.name || !dto.name.trim()) throw new BadRequestException('Group name is required');
    const group = this.groups.create({
      id: newId('g'),
      name: dto.name.trim(),
      faculty: dto.faculty || 'ФІОТ',
      studyYear: Number(dto.studyYear) || 1,
      studentsCount: 25,
      assignedCourseIds: ['c-1'],
      studentsList: ['Олександр Петренко', 'Марія Бондаренко'],
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
}
