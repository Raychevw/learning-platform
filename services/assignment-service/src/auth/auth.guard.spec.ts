import { describe, it, expect } from 'vitest';
import { Reflector } from '@nestjs/core';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { AuthGuard, PUBLIC_KEY, ROLES_KEY, UserRole } from './auth.guard.js';

const SECRET = 'unit_test_secret_at_least_32_characters_long';

function makeGuard(meta: Record<string, unknown> = {}) {
  const reflector = {
    getAllAndOverride: (key: string) => meta[key],
  } as unknown as Reflector;

  const config = {
    get: (key: string, fallback?: unknown) => {
      if (key === 'JWT_SECRET') return SECRET;
      if (key === 'TRUST_GATEWAY_HEADERS') return 'false';
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

function token(role: UserRole, extra: Record<string, unknown> = {}) {
  return jwt.sign(
    { sub: 'usr-student', email: 's@univ.edu', role, name: encodeURIComponent('Олександр Петренко'), ...extra },
    SECRET,
    { expiresIn: '5m' },
  );
}

describe('AuthGuard (assignment-service)', () => {
  it('публичный health доступен без токена', () => {
    const guard = makeGuard({ [PUBLIC_KEY]: true });
    const { context } = makeContext();
    expect(guard.canActivate(context)).toBe(true);
  });

  it('без токена — 401', () => {
    const guard = makeGuard();
    const { context } = makeContext();
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('студент не может создавать задания (403)', () => {
    const guard = makeGuard({ [ROLES_KEY]: [UserRole.TEACHER, UserRole.ADMIN] });
    const { context } = makeContext({ authorization: `Bearer ${token(UserRole.STUDENT)}` });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('преподаватель может создавать задания', () => {
    const guard = makeGuard({ [ROLES_KEY]: [UserRole.TEACHER, UserRole.ADMIN] });
    const { context } = makeContext({ authorization: `Bearer ${token(UserRole.TEACHER)}` });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('прокидывает личность студента из токена', () => {
    const guard = makeGuard({ [ROLES_KEY]: [UserRole.STUDENT] });
    const { context, request } = makeContext({ authorization: `Bearer ${token(UserRole.STUDENT)}` });
    expect(guard.canActivate(context)).toBe(true);
    expect(request.user.userId).toBe('usr-student');
    expect(request.user.name).toBe(encodeURIComponent('Олександр Петренко'));
  });
});
