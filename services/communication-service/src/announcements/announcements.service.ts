import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import crypto from 'node:crypto';
import { AnnouncementEntity } from './announcement.entity.js';
import type { CreateAnnouncementDto } from './announcement.dto.js';
import type { AuthUser } from '../messages/message.guard.js';

@Injectable()
export class AnnouncementsService {
  constructor(
    @InjectRepository(AnnouncementEntity)
    private readonly announcements: Repository<AnnouncementEntity>,
  ) {}

  async create(user: AuthUser, dto: CreateAnnouncementDto) {
    if (!dto.title?.trim() || !dto.body?.trim()) {
      throw new BadRequestException('Заголовок і текст оголошення обовʼязкові');
    }
    const audience = dto.audience || 'ALL';
    if (audience === 'GROUP' && !dto.groupId) {
      throw new BadRequestException('Для оголошення групі вкажіть groupId');
    }

    const saved = await this.announcements.save(
      this.announcements.create({
        id: `ann-${crypto.randomUUID()}`,
        authorId: user.userId,
        authorName: user.name || user.email || user.userId,
        authorRole: (user.role || '').toLowerCase(),
        title: dto.title.trim(),
        body: dto.body.trim(),
        audience,
        groupId: audience === 'GROUP' ? dto.groupId || null : null,
      }),
    );
    return this.toDto(saved);
  }

  async list(user: AuthUser, groupId?: string) {
    const rows = await this.announcements.find({ order: { createdAt: 'DESC' }, take: 100 });
    const role = user.role;

    return rows
      .filter((item) => {
        if (role === 'ADMIN') return true;
        if (item.audience === 'ALL') return true;
        if (item.audience === 'STUDENTS') return role === 'STUDENT';
        if (item.audience === 'TEACHERS') return role === 'TEACHER';
        if (item.audience === 'GROUP') return Boolean(groupId) && item.groupId === groupId;
        return false;
      })
      .map((item) => this.toDto(item));
  }

  async remove(id: string, user: AuthUser) {
    const announcement = await this.announcements.findOneBy({ id });
    if (!announcement) throw new NotFoundException('Оголошення не знайдено');
    if (user.role !== 'ADMIN' && announcement.authorId !== user.userId) {
      throw new ForbiddenException('Можна видаляти лише власні оголошення');
    }
    await this.announcements.remove(announcement);
    return { ok: true, id };
  }

  private toDto(item: AnnouncementEntity) {
    return {
      id: item.id,
      authorId: item.authorId,
      authorName: item.authorName,
      authorRole: item.authorRole,
      title: item.title,
      body: item.body,
      audience: item.audience,
      groupId: item.groupId,
      createdAt: item.createdAt,
    };
  }
}
