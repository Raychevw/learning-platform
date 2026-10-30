import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import type { IStorageService } from '../infrastructure/storage/storage.service.js';
import { STORAGE_SERVICE_TOKEN } from '../infrastructure/storage/storage.service.js';
import { formatFileSize, safeFileName } from './upload.config.js';
import { CourseEntity } from '../infrastructure/database/entities/CourseEntity.js';
import {
  CourseModuleEntity,
  LessonEntity,
  LessonCompletionEntity,
  WebinarEntity,
  WebinarChatMessage,
  ScheduleEntryEntity,
} from '../infrastructure/database/entities/CatalogEntities.js';
import { WebinarEventsService } from './webinar-events.service.js';

export const newId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export interface CreateCatalogCourseDto {
  title: string;
  description?: string;
  instructor?: string;
  semester?: number;
  totalHours?: number;
  cover?: string;
}

interface RequestUser {
  userId: string;
  role: string;
}

/** Викладач може керувати лише своїми дисциплінами; адміністратор — усіма. */
async function assertCourseOwner(
  courses: Repository<CourseEntity>,
  courseId: string,
  user: RequestUser,
): Promise<CourseEntity> {
  const course = await courses.findOneBy({ id: courseId });
  if (!course) throw new NotFoundException(`Course ${courseId} not found`);
  if (user.role === 'ADMIN') return course;
  if (course.ownerId && course.ownerId !== user.userId) {
    throw new ForbiddenException('Ця дисципліна закріплена за іншим викладачем');
  }
  if (!course.ownerId) {
    course.ownerId = user.userId;
    await courses.save(course);
  }
  return course;
}

/**
 * Read/write model of the course catalog (courses -> modules -> lessons) and webinars.
 * Returns data in the shape consumed by the React frontend.
 */
@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(CourseEntity) private readonly courses: Repository<CourseEntity>,
    @InjectRepository(CourseModuleEntity) private readonly modules: Repository<CourseModuleEntity>,
    @InjectRepository(LessonEntity) private readonly lessons: Repository<LessonEntity>,
    @InjectRepository(LessonCompletionEntity) private readonly completions: Repository<LessonCompletionEntity>,
    @InjectRepository(WebinarEntity) private readonly webinars: Repository<WebinarEntity>,
    @InjectRepository(ScheduleEntryEntity) private readonly schedule: Repository<ScheduleEntryEntity>,
    private readonly dataSource: DataSource,
    private readonly events: WebinarEventsService,
    @Inject(STORAGE_SERVICE_TOKEN) private readonly storage: IStorageService,
  ) {}

  // ----------------------------------------------------------------- courses
  async listCatalog(userId?: string) {
    const courses = await this.courses.find({ order: { createdAt: 'ASC' } });
    if (courses.length === 0) return [];

    const modules = await this.modules.find({
      where: { courseId: In(courses.map((c) => c.id)) },
      order: { orderIndex: 'ASC' },
    });
    const lessons = modules.length
      ? await this.lessons.find({ where: { moduleId: In(modules.map((m) => m.id)) }, order: { orderIndex: 'ASC' } })
      : [];
    const done = userId ? await this.completions.find({ where: { userId } }) : [];
    const doneSet = new Set(done.map((d) => d.lessonId));

    return courses.map((c) => {
      const courseModules = modules
        .filter((m) => m.courseId === c.id)
        .map((m) => ({
          id: m.id,
          title: m.title,
          lessons: lessons
            .filter((l) => l.moduleId === m.id)
            .map((l) => this.toLessonDto(l, doneSet.has(l.id))),
        }));
      const all = courseModules.flatMap((m) => m.lessons);
      const progress = all.length ? Math.round((all.filter((l) => l.completed).length / all.length) * 100) : 0;
      return {
        id: c.id,
        title: c.title,
        instructor: c.instructor,
        ownerId: c.ownerId || null,
        description: c.description,
        semester: c.semester,
        totalHours: c.totalHours,
        isPublished: c.isPublished,
        cover: c.cover,
        modulesCount: courseModules.length,
        modules: courseModules,
        progress,
      };
    });
  }

  async createCourse(dto: CreateCatalogCourseDto, ownerId?: string) {
    if (!dto.title || !dto.title.trim()) throw new BadRequestException('Course title cannot be empty');
    const course = this.courses.create({
      id: newId('c'),
      title: dto.title.trim(),
      description: (dto.description || '').trim(),
      instructor: dto.instructor || '',
      ownerId: ownerId || null,
      semester: Number(dto.semester) || 1,
      totalHours: Number(dto.totalHours) || 90,
      cover: dto.cover || '/course-coding.jpg',
      isPublished: false,
    });

    // Курс + вступительный модуль + лекция создаются атомарно.
    const moduleId = newId('m');
    await this.dataSource.transaction(async (em) => {
      await em.save(CourseEntity, course);
      await em.save(CourseModuleEntity, {
        id: moduleId,
        courseId: course.id,
        title: 'Модуль 1: Вступ та основні поняття курсу',
        orderIndex: 1,
      });
      await em.save(LessonEntity, {
        id: newId('l'),
        moduleId,
        title: 'Лекція 1: Вступна лекція та робоча програма',
        type: 'Лекція',
        content: course.description || 'Матеріали вступної лекції та критерії оцінювання за семестр.',
        orderIndex: 1,
      });
    });
    return { id: course.id };
  }

  async addModule(courseId: string, title: string, user: RequestUser) {
    if (!title || !title.trim()) throw new BadRequestException('Module title cannot be empty');
    await assertCourseOwner(this.courses, courseId, user);
    const count = await this.modules.countBy({ courseId });
    const mod = await this.modules.save(
      this.modules.create({ id: newId('m'), courseId, title: title.trim(), orderIndex: count + 1 }),
    );
    return { id: mod.id, title: mod.title, lessons: [] };
  }

  async addLesson(
    moduleId: string,
    dto: { title: string; type?: string; content?: string; linkUrl?: string; videoUrl?: string },
    user: RequestUser,
    file?: { buffer: Buffer; originalname: string; mimetype: string; size: number } | null,
  ) {
    if (!dto.title || !dto.title.trim()) throw new BadRequestException('Lesson title cannot be empty');
    const mod = await this.modules.findOneBy({ id: moduleId });
    if (!mod) throw new NotFoundException(`Module ${moduleId} not found`);
    await assertCourseOwner(this.courses, mod.courseId, user);
    const count = await this.lessons.countBy({ moduleId });

    let fileKey: string | null = null;
    let fileName = '';
    let fileSize = '';
    let mimeType: string | null = null;

    if (file) {
      fileKey = `materials/${moduleId}/${crypto.randomUUID()}-${safeFileName(file.originalname)}`;
      await this.storage.put(fileKey, file.buffer, file.mimetype);
      fileName = file.originalname;
      fileSize = formatFileSize(file.size);
      mimeType = file.mimetype;
    }

    const lesson = await this.lessons.save(
      this.lessons.create({
        id: newId('l'),
        moduleId,
        title: dto.title.trim(),
        type: dto.type || 'Лекція',
        content:
          (dto.content || '').trim() ||
          'Навчальний матеріал для самостійного опрацювання та підготовки до практичних робіт.',
        linkUrl: (dto.linkUrl || '').trim(),
        videoUrl: (dto.videoUrl || '').trim(),
        fileKey,
        fileName,
        fileSize,
        mimeType,
        orderIndex: count + 1,
      }),
    );
    return this.toLessonDto(lesson, false);
  }

  async updateLesson(
    lessonId: string,
    dto: { title?: string; type?: string; content?: string; linkUrl?: string; videoUrl?: string },
    user: RequestUser,
    file?: { buffer: Buffer; originalname: string; mimetype: string; size: number } | null,
  ) {
    const lesson = await this.lessons.findOneBy({ id: lessonId });
    if (!lesson) throw new NotFoundException(`Lesson ${lessonId} not found`);
    const lessonModule = await this.modules.findOneBy({ id: lesson.moduleId });
    if (!lessonModule) throw new NotFoundException(`Module ${lesson.moduleId} not found`);
    await assertCourseOwner(this.courses, lessonModule.courseId, user);

    if (dto.title !== undefined) {
      if (!dto.title.trim()) throw new BadRequestException('Lesson title cannot be empty');
      lesson.title = dto.title.trim();
    }
    if (dto.type !== undefined) lesson.type = dto.type;
    if (dto.content !== undefined) lesson.content = dto.content.trim();
    if (dto.linkUrl !== undefined) lesson.linkUrl = dto.linkUrl.trim();
    if (dto.videoUrl !== undefined) lesson.videoUrl = dto.videoUrl.trim();

    if (file) {
      const newKey = `materials/${lesson.moduleId}/${crypto.randomUUID()}-${safeFileName(file.originalname)}`;
      await this.storage.put(newKey, file.buffer, file.mimetype);
      if (lesson.fileKey) await this.storage.delete(lesson.fileKey).catch(() => undefined);
      lesson.fileKey = newKey;
      lesson.fileName = file.originalname;
      lesson.fileSize = formatFileSize(file.size);
      lesson.mimeType = file.mimetype;
    }

    const saved = await this.lessons.save(lesson);
    return this.toLessonDto(saved, false);
  }

  async getLessonFile(lessonId: string) {
    const lesson = await this.lessons.findOneBy({ id: lessonId });
    if (!lesson) throw new NotFoundException(`Lesson ${lessonId} not found`);
    if (!lesson.fileKey) throw new NotFoundException('До цього матеріалу не прикріплено файл');
    const stream: Readable = await this.storage.getStream(lesson.fileKey);
    return {
      stream,
      fileName: lesson.fileName || 'material',
      mimeType: lesson.mimeType || 'application/octet-stream',
    };
  }

  private toLessonDto(lesson: LessonEntity, completed: boolean) {
    return {
      id: lesson.id,
      title: lesson.title,
      type: lesson.type,
      content: lesson.content,
      linkUrl: lesson.linkUrl || '',
      videoUrl: lesson.videoUrl || '',
      fileName: lesson.fileName || '',
      fileSize: lesson.fileSize || '',
      mimeType: lesson.mimeType || null,
      hasFile: Boolean(lesson.fileKey),
      downloadUrl: lesson.fileKey ? `/api/catalog/lessons/${lesson.id}/file` : null,
      completed,
    };
  }

  async toggleLessonCompleted(lessonId: string, userId: string) {
    if (!userId) throw new BadRequestException('userId is required');
    const lesson = await this.lessons.findOneBy({ id: lessonId });
    if (!lesson) throw new NotFoundException(`Lesson ${lessonId} not found`);
    const existing = await this.completions.findOneBy({ lessonId, userId });
    if (existing) {
      await this.completions.delete({ lessonId, userId });
      return { lessonId, completed: false };
    }
    await this.completions.save(this.completions.create({ lessonId, userId }));
    return { lessonId, completed: true };
  }

  // ---------------------------------------------------------------- webinars
  private toWebinarDto(w: WebinarEntity, courseTitle: string) {
    return {
      id: w.id,
      courseId: w.courseId,
      courseTitle,
      title: w.title,
      instructor: w.instructor,
      scheduledAt: w.scheduledAt instanceof Date ? w.scheduledAt.toISOString() : w.scheduledAt,
      status: w.status,
      chat: w.chat || [],
    };
  }

  async listWebinars() {
    const list = await this.webinars.find({ order: { scheduledAt: 'ASC' } });
    const courses = await this.courses.find();
    const titles = new Map(courses.map((c) => [c.id, c.title]));
    return list.map((w) => this.toWebinarDto(w, titles.get(w.courseId) || ''));
  }

  async createWebinar(
    dto: { courseId: string; title: string; scheduledAt: string; instructor?: string; senderRole?: string },
    user: RequestUser,
  ) {
    if (!dto.title || !dto.title.trim()) throw new BadRequestException('Webinar title cannot be empty');
    const course = await assertCourseOwner(this.courses, dto.courseId, user);
    const scheduledAt = new Date(dto.scheduledAt);
    if (isNaN(scheduledAt.getTime())) throw new BadRequestException('Invalid scheduledAt date');

    const webinar = await this.webinars.save(
      this.webinars.create({
        id: newId('web'),
        courseId: course.id,
        title: dto.title.trim(),
        instructor: dto.instructor || course.instructor,
        scheduledAt,
        status: 'SCHEDULED',
        chat: [
          {
            id: newId('msg'),
            senderName: dto.instructor || 'Викладач',
            senderRole: dto.senderRole || 'teacher',
            text: `Онлайн-заняття «${dto.title.trim()}» додано до розкладу.`,
            time: new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Kyiv' }),
          },
        ],
      }),
    );
    const created = this.toWebinarDto(webinar, course.title);
    this.events.emit({ type: 'webinar', webinarId: webinar.id, webinar: created });
    return created;
  }

  async changeWebinarStatus(id: string, status: string, user: RequestUser) {
    const allowed = ['SCHEDULED', 'LIVE', 'FINISHED'];
    if (!allowed.includes(status)) throw new BadRequestException(`Status must be one of ${allowed.join(', ')}`);
    const webinar = await this.webinars.findOneBy({ id });
    if (!webinar) throw new NotFoundException(`Webinar ${id} not found`);
    await assertCourseOwner(this.courses, webinar.courseId, user);
    webinar.status = status;
    await this.webinars.save(webinar);
    this.events.emit({ type: 'status', webinarId: id, status });
    return { id, status };
  }

  async addChatMessage(id: string, dto: Partial<WebinarChatMessage>) {
    if (!dto.text || !dto.text.trim()) throw new BadRequestException('Message text cannot be empty');
    const webinar = await this.webinars.findOneBy({ id });
    if (!webinar) throw new NotFoundException(`Webinar ${id} not found`);
    const message: WebinarChatMessage = {
      id: dto.id || newId('msg'),
      senderName: dto.senderName || 'Користувач',
      senderRole: dto.senderRole || 'student',
      text: dto.text.trim(),
      time: dto.time || new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Kyiv' }),
    };
    webinar.chat = [...(webinar.chat || []), message];
    await this.webinars.save(webinar);
    this.events.emit({ type: 'chat', webinarId: id, message });
    return message;
  }

  // ----------------------------------------------------------------- schedule
  async listSchedule(filters: { groupId?: string; courseId?: string }) {
    const where: Record<string, string> = {};
    if (filters.groupId) where.groupId = filters.groupId;
    if (filters.courseId) where.courseId = filters.courseId;

    const entries = await this.schedule.find({
      where,
      order: { weekday: 'ASC', startTime: 'ASC' },
    });
    if (entries.length === 0) return [];

    const courseIds = Array.from(new Set(entries.map((e) => e.courseId)));
    const courses = await this.courses.find({ where: { id: In(courseIds) } });

    return entries.map((entry) => {
      const course = courses.find((c) => c.id === entry.courseId);
      return {
        id: entry.id,
        courseId: entry.courseId,
        courseTitle: course?.title || '',
        groupId: entry.groupId,
        weekday: entry.weekday,
        startTime: entry.startTime,
        endTime: entry.endTime,
        room: entry.room,
        lessonType: entry.lessonType,
        teacherName: entry.teacherName || course?.instructor || '',
        onlineUrl: entry.onlineUrl,
      };
    });
  }

  async createSchedule(dto: {
    courseId: string;
    groupId: string;
    weekday: number;
    startTime: string;
    endTime: string;
    room?: string;
    lessonType?: string;
    teacherName?: string;
    onlineUrl?: string;
  }, user: RequestUser) {
    if (!dto.courseId || !dto.groupId) {
      throw new BadRequestException('courseId та groupId є обовʼязковими');
    }
    const weekday = Number(dto.weekday);
    if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) {
      throw new BadRequestException('weekday має бути від 1 до 7');
    }
    if (!/^\d{2}:\d{2}$/.test(dto.startTime) || !/^\d{2}:\d{2}$/.test(dto.endTime)) {
      throw new BadRequestException('Час має бути у форматі HH:MM');
    }
    const course = await assertCourseOwner(this.courses, dto.courseId, user);

    const entry = await this.schedule.save(
      this.schedule.create({
        id: newId('sch'),
        courseId: dto.courseId,
        groupId: dto.groupId,
        weekday,
        startTime: dto.startTime,
        endTime: dto.endTime,
        room: dto.room || '',
        lessonType: dto.lessonType || 'Лекція',
        teacherName: dto.teacherName || course.instructor || '',
        onlineUrl: dto.onlineUrl || '',
      }),
    );

    return { ...entry, courseTitle: course.title };
  }

  /** Публічна перевірка прав для інших контролерів (наприклад, publish). */
  async assertCanManage(courseId: string, user: RequestUser) {
    await assertCourseOwner(this.courses, courseId, user);
  }

  /** Призначення відповідального викладача (деканат). */
  async assignOwner(courseId: string, ownerId: string | null) {
    const course = await this.courses.findOneBy({ id: courseId });
    if (!course) throw new NotFoundException(`Course ${courseId} not found`);
    course.ownerId = ownerId || null;
    await this.courses.save(course);
    return { id: course.id, ownerId: course.ownerId };
  }

  async deleteSchedule(id: string, user: RequestUser) {
    const entry = await this.schedule.findOneBy({ id });
    if (!entry) throw new NotFoundException(`Schedule entry ${id} not found`);
    await assertCourseOwner(this.courses, entry.courseId, user);
    await this.schedule.remove(entry);
    return { ok: true, id };
  }

  /** Релей WebRTC-сигналинга: сервер не хранит SDP, только пересылает участникам. */
  async relaySignal(
    webinarId: string,
    dto: { to?: string | null; signalType: string; payload?: unknown },
    user: { userId: string; role: string; name?: string },
  ) {
    const allowed = ['offer', 'answer', 'ice', 'join', 'leave', 'media-start', 'media-stop', 'hand'];
    if (!allowed.includes(dto.signalType)) {
      throw new BadRequestException(`Unsupported signal type: ${dto.signalType}`);
    }
    const webinar = await this.webinars.findOneBy({ id: webinarId });
    if (!webinar) throw new NotFoundException(`Webinar ${webinarId} not found`);

    this.events.emit({
      type: 'signal',
      webinarId,
      from: user.userId,
      fromRole: (user.role || '').toLowerCase(),
      fromName: user.name,
      to: dto.to || null,
      signalType: dto.signalType,
      payload: dto.payload ?? null,
    });
    return { ok: true };
  }

  async deleteWebinar(id: string, user: RequestUser) {
    const webinar = await this.webinars.findOneBy({ id });
    if (!webinar) throw new NotFoundException(`Webinar ${id} not found`);
    await assertCourseOwner(this.courses, webinar.courseId, user);
    await this.webinars.remove(webinar);
    this.events.emit({ type: 'deleted', webinarId: id });
    return { ok: true, id };
  }
}
