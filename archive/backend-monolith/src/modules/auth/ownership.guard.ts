import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { AuditStatus } from '../../infrastructure/database/entities/AuditLogEntity.js';
import { UserRole } from '../../infrastructure/database/entities/UserEntity.js';

@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(private readonly auditService: AuditService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const currentUserId = request.headers['x-user-id'] || request.user?.id;
    const currentUserRole = (request.headers['x-user-role'] as UserRole) || request.user?.role || UserRole.STUDENT;
    const ip = request.ip || '127.0.0.1';

    // Admins bypass ownership checks
    if (currentUserRole === UserRole.ADMIN) {
      return true;
    }

    const requestedStudentId = request.params.studentId || request.query.studentId || request.body?.student_id;
    
    // If resource is bound to a specific student, enforce ownership
    if (requestedStudentId && currentUserId && requestedStudentId !== currentUserId) {
      await this.auditService.logEvent(
        `UNAUTHORIZED_RESOURCE_OWNERSHIP_ATTEMPT [TargetStudent: ${requestedStudentId}]`,
        request.url,
        AuditStatus.DENIED,
        currentUserId,
        ip,
      );
      throw new ForbiddenException('Доступ заборонено: спроба доступу до даних іншого студента.');
    }

    return true;
  }
}
