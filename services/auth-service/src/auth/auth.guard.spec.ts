import { describe, it, expect } from 'vitest';
import { Reflector } from '@nestjs/core';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { AuthGuard, PUBLIC_KEY, ROLES_KEY } from './auth.guard.js';
import { UserRole } from '../users/roles.js';

const SECRET = 'unit_test_secret_at_least_32_characters_long';

function makeGuard(meta: Record<string, unknown> = {}, trustGatewayHeaders = false) {
  const reflector = {
    getAllAndOverride: (key: string) => meta[key],
  } as unknown as Reflector;

  const config = {
    get: (key: string, fallback?: unknown) => {
      if (key === 'JWT_SECRET') return SECRET;
      if (key === 'TRUST_GATEWAY_HEADERS') return trustGatewayHeaders ? 'true' : 'false';
      return fallback;
    },
  } as any;

  return new AuthGuard(reflector, config);
}

function makeContext(headers: Record<string, unknown> = {}) {
  const request: any = { headers };
  return {
    request,
    context: {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as any,
  };
}

function sign(role: UserRole = UserRole.STUDENT) {
  return jwt.sign({ sub: 'usr-student', email: 's@univ.edu', role, name: 'Студент' }, SECRET, { expiresIn: '5m' });
}

describe('AuthGuard (auth-service)', () => {
  it('пропускает публичные endpoints без токена', () => {
    const guard = makeGuard({ [PUBLIC_KEY]: true });
    const { context } = makeContext();
    expect(guard.canActivate(context)).toBe(true);
  });

  it('отклоняет защищённый endpoint без токена', () => {
    const guard = makeGuard();
    const { context } = makeContext();
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('принимает валидный JWT и заполняет request.user', () => {
    const guard = makeGuard();
    const { context, request } = makeContext({ authorization: `Bearer ${sign()}` });
    expect(guard.canActivate(context)).toBe(true);
    expect(request.user.userId).toBe('usr-student');
    expect(request.user.role).toBe(UserRole.STUDENT);
  });

  it('отклоняет токен с неверной подписью', () => {
    const guard = makeGuard();
    const forged = jwt.sign({ sub: 'hacker', role: UserRole.ADMIN }, 'another_secret_that_is_long_enough_123', {
      expiresIn: '5m',
    });
    const { context } = makeContext({ authorization: `Bearer ${forged}` });
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('применяет @Roles и запрещает чужую роль', () => {
    const guard = makeGuard({ [ROLES_KEY]: [UserRole.TEACHER, UserRole.ADMIN] });
    const { context } = makeContext({ authorization: `Bearer ${sign(UserRole.STUDENT)}` });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('разрешает роль из @Roles', () => {
    const guard = makeGuard({ [ROLES_KEY]: [UserRole.TEACHER] });
    const { context } = makeContext({ authorization: `Bearer ${sign(UserRole.TEACHER)}` });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('игнорирует клиентские x-user-* заголовки без токена', () => {
    const guard = makeGuard();
    const { context } = makeContext({ 'x-user-id': 'usr-admin', 'x-user-role': 'ADMIN' });
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('доверяет x-user-* только при TRUST_GATEWAY_HEADERS=true', () => {
    const guard = makeGuard({}, true);
    const { context, request } = makeContext({ 'x-user-id': 'usr-teacher', 'x-user-role': 'TEACHER' });
    expect(guard.canActivate(context)).toBe(true);
    expect(request.user.userId).toBe('usr-teacher');
  });
});
