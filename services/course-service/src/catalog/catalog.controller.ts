import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Req,
  Sse,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
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
  create(@Body() dto: CreateCatalogCourseDto) {
    return this.catalog.createCourse(dto);
  }

  @Post(':courseId/modules')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a module to a course' })
  addModule(@Param('courseId') courseId: string, @Body() dto: { title: string }) {
    return this.catalog.addModule(courseId, dto?.title);
  }

  @Post('modules/:moduleId/lessons')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
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
    @Req() req: { user?: AuthUser },
  ) {
    return this.catalog.createWebinar({
      ...dto,
      instructor: req.user?.name || dto.instructor,
      senderRole: req.user?.role ? req.user.role.toLowerCase() : dto.senderRole,
    });
  }

  @Patch(':id/status')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Change webinar status (SCHEDULED | LIVE | FINISHED)' })
  status(@Param('id') id: string, @Body() dto: { status: string }) {
    return this.catalog.changeWebinarStatus(id, dto?.status);
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
  delete(@Param('id') id: string) {
    return this.catalog.deleteWebinar(id);
  }
}
