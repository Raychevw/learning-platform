import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import crypto from 'node:crypto';
import { MessageEntity } from './message.entity.js';
import type { SendMessageDto } from './message.dto.js';
import type { AuthUser } from './message.guard.js';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(MessageEntity)
    private readonly messages: Repository<MessageEntity>,
  ) {}

  async send(user: AuthUser, dto: SendMessageDto) {
    if (!dto.body?.trim()) throw new BadRequestException('Повідомлення не може бути порожнім');
    if (dto.recipientId === user.userId) {
      throw new BadRequestException('Не можна надіслати повідомлення самому собі');
    }

    const message = this.messages.create({
      id: `msg-${crypto.randomUUID()}`,
      senderId: user.userId,
      senderName: user.name || user.email || user.userId,
      senderRole: (user.role || '').toLowerCase(),
      recipientId: dto.recipientId,
      recipientName: dto.recipientName || dto.recipientId,
      subject: (dto.subject || '').trim(),
      body: dto.body.trim(),
      courseId: dto.courseId || null,
    });

    const saved = await this.messages.save(message);
    return this.toDto(saved);
  }

  async inbox(userId: string) {
    const rows = await this.messages.find({
      where: { recipientId: userId },
      order: { createdAt: 'DESC' },
      take: 200,
    });
    return rows.map((row) => this.toDto(row));
  }

  async sent(userId: string) {
    const rows = await this.messages.find({
      where: { senderId: userId },
      order: { createdAt: 'DESC' },
      take: 200,
    });
    return rows.map((row) => this.toDto(row));
  }

  async unreadCount(userId: string) {
    const unread = await this.messages.count({ where: { recipientId: userId, readAt: IsNull() } });
    return { unread };
  }

  async markRead(id: string, userId: string) {
    const message = await this.messages.findOneBy({ id });
    if (!message) throw new NotFoundException('Повідомлення не знайдено');
    if (message.recipientId !== userId) {
      throw new NotFoundException('Повідомлення не знайдено');
    }
    if (!message.readAt) {
      message.readAt = new Date();
      await this.messages.save(message);
    }
    return this.toDto(message);
  }

  private toDto(message: MessageEntity) {
    return {
      id: message.id,
      senderId: message.senderId,
      senderName: message.senderName,
      senderRole: message.senderRole,
      recipientId: message.recipientId,
      recipientName: message.recipientName,
      subject: message.subject,
      body: message.body,
      courseId: message.courseId,
      readAt: message.readAt,
      unread: !message.readAt,
      createdAt: message.createdAt,
    };
  }
}
