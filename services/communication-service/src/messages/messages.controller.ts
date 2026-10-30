import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MessagesService } from './messages.service.js';
import { SendMessageDto } from './message.dto.js';
import type { AuthUser } from './message.guard.js';

@ApiTags('Messages')
@ApiBearerAuth()
@Controller('messages')
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Send a message to a user' })
  send(@Body() dto: SendMessageDto, @Req() req: { user: AuthUser }) {
    return this.messages.send(req.user, dto);
  }

  @Get('inbox')
  @ApiOperation({ summary: 'Incoming messages for the current user' })
  inbox(@Req() req: { user: AuthUser }) {
    return this.messages.inbox(req.user.userId);
  }

  @Get('sent')
  @ApiOperation({ summary: 'Messages sent by the current user' })
  sent(@Req() req: { user: AuthUser }) {
    return this.messages.sent(req.user.userId);
  }

  @Get('unread')
  @ApiOperation({ summary: 'Unread messages count' })
  unread(@Req() req: { user: AuthUser }) {
    return this.messages.unreadCount(req.user.userId);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a message as read' })
  markRead(@Param('id') id: string, @Req() req: { user: AuthUser }) {
    return this.messages.markRead(id, req.user.userId);
  }
}
