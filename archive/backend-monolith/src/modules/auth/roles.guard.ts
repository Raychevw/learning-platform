import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator.js';
import { UserRole } from '../../infrastructure/database/entities/UserEntity.js';
import { AuditService } from '../audit/audit.service.js';
import { AuditStatus } from '../../infrastructure/database/entities/AuditLogEntity.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    // In our university environment, user identity comes from session / header or auth token
    const userRole = (request.headers['x-user-role'] as UserRole) || (request.user?.role as UserRole) || UserRole.STUDENT;
    const userId = request.headers['x-user-id'] || request.user?.id || 'anonymous';
    const ip = request.ip || request.socket.remoteAddress || '127.0.0.1';

    const hasRole = requiredRoles.includes(userRole);
    if (!hasRole) {
      await this.auditService.logEvent(
        `RBAC_ROLE_CHECK_FAILED [Required: ${requiredRoles.join(',')}, Actual: ${userRole}]`,
        request.url,
        AuditStatus.DENIED,
        userId,
        ip,
      );
      throw new ForbiddenException(`Доступ заборонено: дія вимагає ролі [${requiredRoles.join(', ')}]`);
    }

    return true;
  }
}
