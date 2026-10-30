import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { CourseEntity } from '../infrastructure/database/entities/CourseEntity.js';
import {
  CourseModuleEntity,
  LessonEntity,
  LessonCompletionEntity,
  WebinarEntity,
  WebinarChatMessage,
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
    private readonly dataSource: DataSource,
    private readonly events: WebinarEventsService,
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
            .map((l) => ({ id: l.id, title: l.title, type: l.type, content: l.content, completed: doneSet.has(l.id) })),
        }));
      const all = courseModules.flatMap((m) => m.lessons);
      const progress = all.length ? Math.round((all.filter((l) => l.completed).length / all.length) * 100) : 0;
      return {
        id: c.id,
        title: c.title,
        instructor: c.instructor,
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

  async createCourse(dto: CreateCatalogCourseDto) {
    if (!dto.title || !dto.title.trim()) throw new BadRequestException('Course title cannot be empty');
    const course = this.courses.create({
      id: newId('c'),
      title: dto.title.trim(),
      description: (dto.description || '').trim(),
      instructor: dto.instructor || '',
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

  async addModule(courseId: string, title: string) {
    if (!title || !title.trim()) throw new BadRequestException('Module title cannot be empty');
    const course = await this.courses.findOneBy({ id: courseId });
    if (!course) throw new NotFoundException(`Course ${courseId} not found`);
    const count = await this.modules.countBy({ courseId });
    const mod = await this.modules.save(
      this.modules.create({ id: newId('m'), courseId, title: title.trim(), orderIndex: count + 1 }),
    );
    return { id: mod.id, title: mod.title, lessons: [] };
  }

  async addLesson(moduleId: string, dto: { title: string; type?: string; content?: string }) {
    if (!dto.title || !dto.title.trim()) throw new BadRequestException('Lesson title cannot be empty');
    const mod = await this.modules.findOneBy({ id: moduleId });
    if (!mod) throw new NotFoundException(`Module ${moduleId} not found`);
    const count = await this.lessons.countBy({ moduleId });
    const lesson = await this.lessons.save(
      this.lessons.create({
        id: newId('l'),
        moduleId,
        title: dto.title.trim(),
        type: dto.type || 'Лекція',
        content: (dto.content || '').trim() || 'Навчальний матеріал для самостійного опрацювання та підготовки до практичних робіт.',
        orderIndex: count + 1,
      }),
    );
    return { id: lesson.id, title: lesson.title, type: lesson.type, content: lesson.content, completed: false };
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

  async createWebinar(dto: { courseId: string; title: string; scheduledAt: string; instructor?: string; senderRole?: string }) {
    if (!dto.title || !dto.title.trim()) throw new BadRequestException('Webinar title cannot be empty');
    const course = await this.courses.findOneBy({ id: dto.courseId });
    if (!course) throw new NotFoundException(`Course ${dto.courseId} not found`);
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

  async changeWebinarStatus(id: string, status: string) {
    const allowed = ['SCHEDULED', 'LIVE', 'FINISHED'];
    if (!allowed.includes(status)) throw new BadRequestException(`Status must be one of ${allowed.join(', ')}`);
    const webinar = await this.webinars.findOneBy({ id });
    if (!webinar) throw new NotFoundException(`Webinar ${id} not found`);
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

  async deleteWebinar(id: string) {
    const webinar = await this.webinars.findOneBy({ id });
    if (!webinar) throw new NotFoundException(`Webinar ${id} not found`);
    await this.webinars.remove(webinar);
    this.events.emit({ type: 'deleted', webinarId: id });
    return { ok: true, id };
  }
}
