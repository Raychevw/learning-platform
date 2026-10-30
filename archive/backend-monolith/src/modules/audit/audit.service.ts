import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogEntity, AuditStatus } from '../../infrastructure/database/entities/AuditLogEntity.js';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly auditRepo: Repository<AuditLogEntity>,
  ) {}

  async logEvent(
    action: string,
    targetResource: string,
    status: AuditStatus = AuditStatus.ALLOWED,
    userId?: string,
    ipAddress: string = '127.0.0.1',
  ): Promise<AuditLogEntity> {
    const entry = this.auditRepo.create({
      user_id: userId,
      ip_address: ipAddress,
      action,
      target_resource: targetResource,
      status,
    });

    const saved = await this.auditRepo.save(entry);
    if (status === AuditStatus.DENIED) {
      this.logger.warn(`[SECURITY AUDIT - ACCESS DENIED] User: ${userId || 'anonymous'}, Action: ${action}, Resource: ${targetResource}`);
    } else {
      this.logger.log(`[AUDIT] Action: ${action}, Resource: ${targetResource}, Status: ${status}`);
    }
    return saved;
  }

  async getAllLogs(): Promise<AuditLogEntity[]> {
    return this.auditRepo.find({
      order: { created_at: 'DESC' },
      take: 100,
    });
  }
}
