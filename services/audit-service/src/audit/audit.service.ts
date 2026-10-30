import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import crypto from 'node:crypto';
import { AuditLogEntity } from './audit.entity.js';
import type { AuditQueryDto, IngestAuditDto } from './audit.dto.js';

export const newId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

const trim = (value: string | undefined, max: number, fallback = '') =>
  (value ?? fallback).toString().slice(0, max);

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly logs: Repository<AuditLogEntity>,
  ) {}

  async ingest(dto: IngestAuditDto) {
    const entry = this.logs.create({
      id: newId('log'),
      userId: trim(dto.userId, 64, 'anonymous'),
      userRole: trim(dto.userRole, 16),
      userName: trim(dto.userName, 255),
      action: trim(dto.action, 128),
      resource: trim(dto.resource, 255),
      method: trim(dto.method, 8, 'GET'),
      path: trim(dto.path, 512),
      statusCode: Number(dto.statusCode) || 0,
      status: dto.status,
      ip: trim(dto.ip, 64),
      requestId: trim(dto.requestId, 64),
    });

    const saved = await this.logs.save(entry);
    return { id: saved.id, createdAt: saved.createdAt };
  }

  async list(query: AuditQueryDto) {
    const limit = Math.min(Math.max(Number(query.limit) || 100, 1), 500);

    const qb = this.logs.createQueryBuilder('l').orderBy('l.createdAt', 'DESC').take(limit);

    if (query.status) qb.andWhere('l.status = :status', { status: query.status });
    if (query.userId) qb.andWhere('l.userId = :userId', { userId: query.userId });
    if (query.search?.trim()) {
      qb.andWhere('(l.action ILIKE :s OR l.userName ILIKE :s OR l.resource ILIKE :s OR l.path ILIKE :s)', {
        s: `%${query.search.trim()}%`,
      });
    }

    const [rows, total] = await qb.getManyAndCount();
    return {
      total,
      limit,
      items: rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        userRole: r.userRole,
        userName: r.userName,
        action: r.action,
        resource: r.resource,
        method: r.method,
        path: r.path,
        statusCode: r.statusCode,
        status: r.status,
        ip: r.ip,
        requestId: r.requestId,
        time: r.createdAt,
      })),
    };
  }

  async stats() {
    const [total, denied, errors, allowed] = await Promise.all([
      this.logs.count(),
      this.logs.count({ where: { status: 'DENIED' } }),
      this.logs.count({ where: { status: 'ERROR' } }),
      this.logs.count({ where: { status: 'ALLOWED' } }),
    ]);

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const last24h = await this.logs
      .createQueryBuilder('l')
      .where('l.createdAt >= :since', { since })
      .getCount();

    const topActions = await this.logs
      .createQueryBuilder('l')
      .select('l.action', 'action')
      .addSelect('COUNT(*)', 'count')
      .groupBy('l.action')
      .orderBy('count', 'DESC')
      .limit(5)
      .getRawMany();

    this.logger.debug(`Audit stats: total=${total}`);
    return {
      total,
      allowed,
      denied,
      errors,
      last24h,
      topActions: topActions.map((r) => ({ action: r.action, count: Number(r.count) })),
    };
  }
}
