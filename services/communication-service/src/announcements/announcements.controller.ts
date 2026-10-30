import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AnnouncementsService } from './announcements.service.js';
import { CreateAnnouncementDto } from './announcement.dto.js';
import { Roles, UserRole } from '../messages/message.guard.js';
import type { AuthUser } from '../messages/message.guard.js';

@ApiTags('Announcements')
@ApiBearerAuth()
@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}

  @Get()
  @ApiOperation({ summary: 'Announcements visible to the current user' })
  list(@Query('groupId') groupId: string | undefined, @Req() req: { user: AuthUser }) {
    return this.announcements.list(req.user, groupId);
  }

  @Post()
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Publish an announcement (teacher/dean)' })
  create(@Body() dto: CreateAnnouncementDto, @Req() req: { user: AuthUser }) {
    return this.announcements.create(req.user, dto);
  }

  @Delete(':id')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete an announcement (author or dean)' })
  remove(@Param('id') id: string, @Req() req: { user: AuthUser }) {
    return this.announcements.remove(id, req.user);
  }
}
