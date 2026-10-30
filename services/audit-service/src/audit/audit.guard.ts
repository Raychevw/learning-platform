import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import jwt from 'jsonwebtoken';

export enum UserRole {
  STUDENT = 'STUDENT',
  TEACHER = 'TEACHER',
  ADMIN = 'ADMIN',
}

export const ROLES_KEY = 'roles';
export const PUBLIC_KEY = 'public';

export const Public = () => SetMetadata(PUBLIC_KEY, true);
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

export interface AuthUser {
  userId: string;
  email?: string;
  role: UserRole;
  name?: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  name: string;
}

export function verifyAccessToken(token: string, secret: string): JwtPayload {
  return jwt.verify(token, secret) as JwtPayload;
}

function decodeHeaderValue(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
    const user = this.resolveUser(request);

    if (isPublic) return true;
    if (!user) throw new UnauthorizedException('Потрібна автентифікація: відсутній або недійсний токен');
    request.user = user;

    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requiredRoles?.length && !requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        `Доступ заборонено: потрібна роль [${requiredRoles.join(', ')}], ваша роль — ${user.role}`,
      );
    }
    return true;
  }

  private resolveUser(request: any): AuthUser | null {
    const header: string = request.headers?.authorization || '';

    if (header.startsWith('Bearer ')) {
      try {
        const payload = verifyAccessToken(header.slice(7).trim(), this.secret);
        return { userId: payload.sub, email: payload.email, role: payload.role, name: payload.name };
      } catch {
        return null;
      }
    }

    if (this.configService.get<string>('TRUST_GATEWAY_HEADERS', 'false') === 'true') {
      const userId = request.headers?.['x-user-id'];
      const role = request.headers?.['x-user-role'] as UserRole | undefined;
      if (userId && role && Object.values(UserRole).includes(role)) {
        return {
          userId,
          role,
          email: request.headers?.['x-user-email'],
          name: decodeHeaderValue(request.headers?.['x-user-name']),
        };
      }
    }
    return null;
  }

  private get secret(): string {
    return this.configService.get<string>('JWT_SECRET', 'change_me_super_long_random_secret_at_least_32_chars');
  }
}

/**
 * Внутренний ingest: только gateway с общим секретом.
 * Не публикуется наружу и не требует пользовательского JWT.
 */
@Injectable()
export class InternalTokenGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const provided = request.headers?.['x-audit-secret'];
    const expected =
      this.configService.get<string>('AUDIT_INGEST_TOKEN') ||
      this.configService.get<string>('JWT_SECRET', '');

    if (!provided || !expected || provided !== expected) {
      throw new UnauthorizedException('Некоректний внутрішній токен аудиту');
    }
    return true;
  }
}
