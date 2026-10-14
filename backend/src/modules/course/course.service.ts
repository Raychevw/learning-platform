import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CourseEntity } from '../../infrastructure/database/entities/CourseEntity.js';
import { CourseModuleEntity } from '../../infrastructure/database/entities/CourseModuleEntity.js';
import { LessonEntity, LessonContentType } from '../../infrastructure/database/entities/LessonEntity.js';
import { LessonCompletionEntity } from '../../infrastructure/database/entities/LessonCompletionEntity.js';
import { S3StorageService } from '../../infrastructure/storage/S3StorageService.js';
import { Redis } from 'ioredis';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CourseService {
  private readonly logger = new Logger(CourseService.name);
  private redisClient: any = null;
  private readonly cacheTTL = 300; // 5 minutes in seconds

  constructor(
    @InjectRepository(CourseEntity)
    private readonly courseRepo: Repository<CourseEntity>,
    @InjectRepository(CourseModuleEntity)
    private readonly moduleRepo: Repository<CourseModuleEntity>,
    @InjectRepository(LessonEntity)
    private readonly lessonRepo: Repository<LessonEntity>,
    @InjectRepository(LessonCompletionEntity)
    private readonly completionRepo: Repository<LessonCompletionEntity>,
    private readonly s3Service: S3StorageService,
    private readonly configService: ConfigService,
  ) {
    const host = this.configService.get<string>('REDIS_HOST', 'localhost');
    const port = this.configService.get<number>('REDIS_PORT', 6379);
    try {
      this.redisClient = new Redis({ host, port, maxRetriesPerRequest: 1, retryStrategy: () => null });
      this.redisClient.on('error', () => {
        this.redisClient = null;
      });
    } catch {
      this.redisClient = null;
    }
  }

  async createCourse(title: string, description: string, teacherId: string, semester: number = 1): Promise<CourseEntity> {
    const course = this.courseRepo.create({
      title,
      description,
      teacher_id: teacherId,
      semester,
      isPublished: false,
    });
    return this.courseRepo.save(course);
  }

  async publishCourse(courseId: string): Promise<CourseEntity> {
    const course = await this.courseRepo.findOne({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Курс не знайдено');
    course.isPublished = true;
    const saved = await this.courseRepo.save(course);
    await this.invalidateCourseCache(courseId);
    return saved;
  }

  async addModule(courseId: string, title: string, orderIndex: number = 0): Promise<CourseModuleEntity> {
    const module = this.moduleRepo.create({ course_id: courseId, title, order_index: orderIndex });
    const saved = await this.moduleRepo.save(module);
    await this.invalidateCourseCache(courseId);
    return saved;
  }

  async addLesson(
    moduleId: string,
    title: string,
    contentType: LessonContentType,
    contentText: string,
    fileBuffer?: Buffer,
    filename?: string,
  ): Promise<LessonEntity> {
    let fileUrl: string | undefined;
    if (fileBuffer && filename) {
      fileUrl = await this.s3Service.uploadFile(filename, fileBuffer, 'application/pdf');
    }

    const lesson = this.lessonRepo.create({
      module_id: moduleId,
      title,
      content_type: contentType,
      content_text: contentText,
      file_url: fileUrl,
    });

    const saved = await this.lessonRepo.save(lesson);
    const mod = await this.moduleRepo.findOne({ where: { id: moduleId } });
    if (mod) await this.invalidateCourseCache(mod.course_id);
    return saved;
  }

  /**
   * High performance course syllabus query with Redis caching (p95 < 300ms)
   */
  async getCourseFullStructure(courseId: string): Promise<any> {
    const cacheKey = `course:structure:${courseId}`;
    if (this.redisClient) {
      try {
        const cached = await this.redisClient.get(cacheKey);
        if (cached) {
          this.logger.log(`[CACHE HIT] Returning course structure for ${courseId} from Redis cache`);
          return JSON.parse(cached);
        }
      } catch {
        // Fallback to database
      }
    }

    const course = await this.courseRepo.findOne({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Курс не знайдено');

    const modules = await this.moduleRepo.find({
      where: { course_id: courseId },
      order: { order_index: 'ASC' },
    });

    const fullModules = await Promise.all(
      modules.map(async (m) => {
        const lessons = await this.lessonRepo.find({
          where: { module_id: m.id },
          order: { order_index: 'ASC' },
        });
        return {
          ...m,
          lessons,
        };
      }),
    );

    const result = {
      ...course,
      modules: fullModules,
    };

    if (this.redisClient) {
      try {
        await this.redisClient.setex(cacheKey, this.cacheTTL, JSON.stringify(result));
        this.logger.log(`[CACHE STORE] Stored course structure for ${courseId} in Redis`);
      } catch {
        // Ignore cache write error
      }
    }

    return result;
  }

  async getAllCourses(): Promise<CourseEntity[]> {
    return this.courseRepo.find({ order: { title: 'ASC' } });
  }

  async markLessonCompleted(studentId: string, lessonId: string): Promise<LessonCompletionEntity> {
    const existing = await this.completionRepo.findOne({ where: { student_id: studentId, lesson_id: lessonId } });
    if (existing) return existing;

    const completion = this.completionRepo.create({
      student_id: studentId,
      lesson_id: lessonId,
    });
    return this.completionRepo.save(completion);
  }

  async getStudentProgress(studentId: string, courseId: string): Promise<number> {
    const structure = await this.getCourseFullStructure(courseId);
    let totalLessons = 0;
    const lessonIds: string[] = [];

    structure.modules?.forEach((m: any) => {
      m.lessons?.forEach((l: any) => {
        totalLessons++;
        lessonIds.push(l.id);
      });
    });

    if (totalLessons === 0) return 0;

    let completedCount = 0;
    for (const lid of lessonIds) {
      const comp = await this.completionRepo.findOne({ where: { student_id: studentId, lesson_id: lid } });
      if (comp) completedCount++;
    }

    return Math.round((completedCount / totalLessons) * 100);
  }

  private async invalidateCourseCache(courseId: string): Promise<void> {
    if (this.redisClient) {
      try {
        await this.redisClient.del(`course:structure:${courseId}`);
        this.logger.log(`[CACHE INVALIDATED] Removed course:structure:${courseId}`);
      } catch {
        // Ignore
      }
    }
  }
}
