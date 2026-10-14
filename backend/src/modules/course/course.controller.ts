import { Controller, Post, Body, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CourseService } from './course.service.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { UserRole } from '../../infrastructure/database/entities/UserEntity.js';
import { LessonContentType } from '../../infrastructure/database/entities/LessonEntity.js';

@ApiTags('Courses & Modules (LMS)')
@Controller('courses')
@UseGuards(RolesGuard)
export class CourseController {
  constructor(private readonly courseService: CourseService) {}

  @Post()
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Створити нову навчальну дисципліну (Викладач/Адмін)' })
  async createCourse(
    @Body('title') title: string,
    @Body('description') description: string,
    @Body('teacher_id') teacherId: string,
    @Body('semester') semester: number,
  ) {
    return this.courseService.createCourse(title, description, teacherId, semester);
  }

  @Post(':id/publish')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Опублікувати курс (робить дисципліну доступною студентам)' })
  async publishCourse(@Param('id') id: string) {
    return this.courseService.publishCourse(id);
  }

  @Post(':id/modules')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Додати змістовий модуль до курсу' })
  async addModule(
    @Param('id') id: string,
    @Body('title') title: string,
    @Body('order_index') orderIndex: number,
  ) {
    return this.courseService.addModule(id, title, orderIndex);
  }

  @Post('modules/:moduleId/lessons')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Додати урок/лекцію/матеріал у модуль' })
  async addLesson(
    @Param('moduleId') moduleId: string,
    @Body('title') title: string,
    @Body('content_type') contentType: LessonContentType,
    @Body('content_text') contentText: string,
  ) {
    return this.courseService.addLesson(moduleId, title, contentType, contentText);
  }

  @Get()
  @ApiOperation({ summary: 'Отримати список усіх дисциплін' })
  async getAllCourses() {
    return this.courseService.getAllCourses();
  }

  @Get(':id/structure')
  @ApiOperation({ summary: 'Отримати повну структуру курсу (модулі та уроки) з кешу Redis' })
  async getCourseStructure(@Param('id') id: string) {
    return this.courseService.getCourseFullStructure(id);
  }

  @Post('lessons/:lessonId/complete/:studentId')
  @ApiOperation({ summary: 'Відмітити урок як переглянутий/виконаний' })
  async completeLesson(
    @Param('lessonId') lessonId: string,
    @Param('studentId') studentId: string,
  ) {
    return this.courseService.markLessonCompleted(studentId, lessonId);
  }

  @Get(':id/progress/:studentId')
  @ApiOperation({ summary: 'Розрахувати відсоток прогресу студента по курсу' })
  async getProgress(
    @Param('id') id: string,
    @Param('studentId') studentId: string,
  ) {
    const progress = await this.courseService.getStudentProgress(studentId, id);
    return { courseId: id, studentId, progressPercent: progress };
  }
}
