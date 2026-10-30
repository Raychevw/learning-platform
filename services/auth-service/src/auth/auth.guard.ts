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
import { UserRole } from '../users/roles.js';

export const ROLES_KEY = 'roles';
export const PUBLIC_KEY = 'public';

/** Endpoint is accessible without a JWT (health checks, login). */
export const Public = () => SetMetadata(PUBLIC_KEY, true);

/** Restrict an endpoint to the listed roles. */
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
  username?: string | null;
}

export function signAccessToken(payload: JwtPayload, secret: string, expiresIn: string): string {
  return jwt.sign(payload, secret, { expiresIn: expiresIn as jwt.SignOptions['expiresIn'] });
}

export function verifyAccessToken(token: string, secret: string): JwtPayload {
  return jwt.verify(token, secret) as JwtPayload;
}

/** Заголовки — ASCII, поэтому gateway кодирует имя через encodeURIComponent. */
function decodeHeaderValue(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Single guard that authenticates the caller and enforces @Roles(...).
 * Auth-service also trusts gateway-injected x-user-* headers only when
 * TRUST_GATEWAY_HEADERS=true (defense in depth for internal calls).
 */
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

    // Trusted internal call coming through the gateway (headers are injected there).
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
