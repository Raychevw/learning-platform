import { Controller, Post, Body, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { WebinarService } from './webinar.service.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { UserRole } from '../../infrastructure/database/entities/UserEntity.js';
import { WebinarStatus } from '../../infrastructure/database/entities/WebinarEntity.js';

@ApiTags('Webinars & Sync Online Classes')
@Controller('webinars')
@UseGuards(RolesGuard)
export class WebinarController {
  constructor(private readonly webinarService: WebinarService) {}

  @Post()
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Запланувати синхронне онлайн-заняття (вебінар)' })
  async scheduleWebinar(
    @Body('course_id') courseId: string,
    @Body('title') title: string,
    @Body('scheduled_at') scheduledAt: string,
  ) {
    return this.webinarService.scheduleWebinar(courseId, title, new Date(scheduledAt));
  }

  @Post(':id/status')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Змінити статус вебінару (SCHEDULED, LIVE, RECONNECTING, FINISHED)' })
  async setStatus(
    @Param('id') id: string,
    @Body('status') status: WebinarStatus,
  ) {
    return this.webinarService.setWebinarStatus(id, status);
  }

  @Post(':id/chat')
  @ApiOperation({ summary: 'Надіслати повідомлення у чат заняття' })
  async postMessage(
    @Param('id') id: string,
    @Body('sender_id') senderId: string,
    @Body('sender_name') senderName: string,
    @Body('message') message: string,
  ) {
    return this.webinarService.postChatMessage(id, senderId, senderName, message);
  }

  @Get(':id/chat')
  @ApiOperation({ summary: 'Отримати історію чату заняття' })
  async getChat(@Param('id') id: string) {
    return this.webinarService.getWebinarChat(id);
  }

  @Get('course/:courseId')
  @ApiOperation({ summary: 'Переглянути заплановані вебінари курсу' })
  async getCourseWebinars(@Param('courseId') courseId: string) {
    return this.webinarService.getWebinarsByCourse(courseId);
  }
}
