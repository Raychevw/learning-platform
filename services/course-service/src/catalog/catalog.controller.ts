import { Controller, Get, Post, Patch, Param, Body, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { CatalogService } from './catalog.service.js';
import type { CreateCatalogCourseDto } from './catalog.service.js';

@ApiTags('Catalog (courses, modules, lessons)')
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @ApiOperation({ summary: 'Full course catalog with modules, lessons and per-user progress' })
  @ApiQuery({ name: 'userId', required: false })
  list(@Query('userId') userId?: string) {
    return this.catalog.listCatalog(userId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a course (draft) with an introductory module and lecture' })
  create(@Body() dto: CreateCatalogCourseDto) {
    return this.catalog.createCourse(dto);
  }

  @Post(':courseId/modules')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a module to a course' })
  addModule(@Param('courseId') courseId: string, @Body() dto: { title: string }) {
    return this.catalog.addModule(courseId, dto?.title);
  }

  @Post('modules/:moduleId/lessons')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a lesson / learning material to a module' })
  addLesson(@Param('moduleId') moduleId: string, @Body() dto: { title: string; type?: string; content?: string }) {
    return this.catalog.addLesson(moduleId, dto || ({} as any));
  }

  @Post('lessons/:lessonId/toggle')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Toggle lesson completion for a user' })
  toggle(@Param('lessonId') lessonId: string, @Body() dto: { userId: string }) {
    return this.catalog.toggleLessonCompleted(lessonId, dto?.userId);
  }
}

@ApiTags('Webinars')
@Controller('webinars')
export class WebinarController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @ApiOperation({ summary: 'List webinars with chat history' })
  list() {
    return this.catalog.listWebinars();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Schedule a webinar' })
  create(@Body() dto: { courseId: string; title: string; scheduledAt: string; instructor?: string; senderRole?: string }) {
    return this.catalog.createWebinar(dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Change webinar status (SCHEDULED | LIVE | FINISHED)' })
  status(@Param('id') id: string, @Body() dto: { status: string }) {
    return this.catalog.changeWebinarStatus(id, dto?.status);
  }

  @Post(':id/chat')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Post a chat message to the webinar' })
  chat(@Param('id') id: string, @Body() dto: { id?: string; senderName?: string; senderRole?: string; text: string; time?: string }) {
    return this.catalog.addChatMessage(id, dto);
  }
}
