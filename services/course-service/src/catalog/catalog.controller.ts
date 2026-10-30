import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Req,
  Res,
  Sse,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiQuery, ApiConsumes, ApiBody } from '@nestjs/swagger';
import type { Response } from 'express';
import { materialMulterOptions } from './upload.config.js';
import { Observable, interval, map, merge } from 'rxjs';
import type { MessageEvent } from '@nestjs/common';
import { CatalogService } from './catalog.service.js';
import type { CreateCatalogCourseDto } from './catalog.service.js';
import { Roles, UserRole } from '../auth/auth.guard.js';
import type { AuthUser } from '../auth/auth.guard.js';
import { WebinarEventsService } from './webinar-events.service.js';

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
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a course (draft) with an introductory module and lecture' })
  create(@Body() dto: CreateCatalogCourseDto, @Req() req: { user: AuthUser }) {
    return this.catalog.createCourse(dto, req.user.userId);
  }

  @Patch(':courseId/owner')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Assign a teacher as the course owner (dean only)' })
  assignOwner(@Param('courseId') courseId: string, @Body() dto: { ownerId?: string | null }) {
    return this.catalog.assignOwner(courseId, dto?.ownerId ?? null);
  }

  @Post(':courseId/modules')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a module to a course' })
  addModule(
    @Param('courseId') courseId: string,
    @Body() dto: { title: string },
    @Req() req: { user: AuthUser },
  ) {
    return this.catalog.addModule(courseId, dto?.title, req.user);
  }

  @Post('modules/:moduleId/lessons')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a lesson / learning material (text, link, video)' })
  addLesson(
    @Param('moduleId') moduleId: string,
    @Body() dto: { title: string; type?: string; content?: string; linkUrl?: string; videoUrl?: string },
    @Req() req: { user: AuthUser },
  ) {
    return this.catalog.addLesson(moduleId, dto || ({} as any), req.user);
  }

  @Post('modules/:moduleId/lessons-file')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file', materialMulterOptions))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Add a lesson with an uploaded file (PDF/Word/PPT/video)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        title: { type: 'string' },
        type: { type: 'string' },
        content: { type: 'string' },
        linkUrl: { type: 'string' },
        videoUrl: { type: 'string' },
      },
    },
  })
  addLessonWithFile(
    @Param('moduleId') moduleId: string,
    @Body() dto: { title?: string; type?: string; content?: string; linkUrl?: string; videoUrl?: string },
    @UploadedFile() file: Express.Multer.File,
    @Req() req: { user: AuthUser },
  ) {
    if (!dto.title?.trim()) throw new BadRequestException('Вкажіть назву матеріалу');
    return this.catalog.addLesson(moduleId, { ...dto, title: dto.title }, req.user, file || null);
  }

  @Patch('lessons/:lessonId')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Edit a learning material (title/content/link/video)' })
  updateLesson(
    @Param('lessonId') lessonId: string,
    @Body() dto: { title?: string; type?: string; content?: string; linkUrl?: string; videoUrl?: string },
    @Req() req: { user: AuthUser },
  ) {
    return this.catalog.updateLesson(lessonId, dto || {}, req.user);
  }

  @Get('lessons/:lessonId/file')
  @ApiOperation({ summary: 'Download an uploaded learning material' })
  async downloadLesson(
    @Param('lessonId') lessonId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { stream, fileName, mimeType } = await this.catalog.getLessonFile(lessonId);
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      'Cache-Control': 'private, no-store',
    });
    return new StreamableFile(stream);
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
  constructor(
    private readonly catalog: CatalogService,
    private readonly events: WebinarEventsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List webinars with chat history' })
  list() {
    return this.catalog.listWebinars();
  }

  /**
   * Server-Sent Events: чат, статус эфира и новые вебинары в реальном времени.
   * Авторизация — обычный Bearer-токен (клиент читает поток через fetch).
   */
  @Sse('stream')
  @ApiOperation({ summary: 'Realtime webinar stream (SSE): chat, status, new webinars' })
  stream(): Observable<MessageEvent> {
    const heartbeat = interval(20000).pipe(
      map(() => ({ data: { type: 'ping', at: Date.now() } }) as MessageEvent),
    );
    const events = this.events
      .asObservable()
      .pipe(map((event) => ({ data: event }) as MessageEvent));
    return merge(events, heartbeat);
  }

  @Post()
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Schedule a webinar' })
  create(
    @Body() dto: { courseId: string; title: string; scheduledAt: string; instructor?: string; senderRole?: string },
    @Req() req: { user: AuthUser },
  ) {
    return this.catalog.createWebinar(
      {
        ...dto,
        instructor: req.user?.name || dto.instructor,
        senderRole: req.user?.role ? req.user.role.toLowerCase() : dto.senderRole,
      },
      req.user,
    );
  }

  @Patch(':id/status')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Change webinar status (SCHEDULED | LIVE | FINISHED)' })
  status(
    @Param('id') id: string,
    @Body() dto: { status: string },
    @Req() req: { user: AuthUser },
  ) {
    return this.catalog.changeWebinarStatus(id, dto?.status, req.user);
  }

  @Post(':id/chat')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Post a chat message to the webinar' })
  chat(
    @Param('id') id: string,
    @Body() dto: { id?: string; senderName?: string; senderRole?: string; text: string; time?: string },
    @Req() req: { user?: AuthUser },
  ) {
    // Личность автора берём из токена, а не из тела запроса.
    return this.catalog.addChatMessage(id, {
      ...dto,
      senderName: req.user?.name || dto.senderName,
      senderRole: req.user?.role ? req.user.role.toLowerCase() : dto.senderRole,
    });
  }

  @Post(':id/signal')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Relay WebRTC signaling (offer/answer/ice/join/hand) to the room' })
  signal(
    @Param('id') id: string,
    @Body() dto: { to?: string | null; signalType: string; payload?: unknown },
    @Req() req: { user: AuthUser },
  ) {
    return this.catalog.relaySignal(id, dto, req.user);
  }

  @Delete(':id')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete or cancel a scheduled webinar' })
  delete(@Param('id') id: string, @Req() req: { user: AuthUser }) {
    return this.catalog.deleteWebinar(id, req.user);
  }
}

@ApiTags('Schedule')
@Controller('schedule')
export class ScheduleController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @ApiOperation({ summary: 'Weekly schedule for a group or a course' })
  list(@Query('groupId') groupId?: string, @Query('courseId') courseId?: string) {
    return this.catalog.listSchedule({ groupId, courseId });
  }

  @Post()
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a schedule entry (pair) for a group' })
  create(
    @Body()
    dto: {
      courseId: string;
      groupId: string;
      weekday: number;
      startTime: string;
      endTime: string;
      room?: string;
      lessonType?: string;
      teacherName?: string;
      onlineUrl?: string;
    },
    @Req() req: { user: AuthUser },
  ) {
    return this.catalog.createSchedule(dto, req.user);
  }

  @Delete(':id')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a schedule entry' })
  remove(@Param('id') id: string, @Req() req: { user: AuthUser }) {
    return this.catalog.deleteSchedule(id, req.user);
  }
}
