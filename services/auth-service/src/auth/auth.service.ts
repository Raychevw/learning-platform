import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { UserEntity, toPublicUser } from '../users/user.entity.js';
import { UserRole } from '../users/roles.js';
import { JwtPayload, signAccessToken } from './auth.guard.js';

export interface LoginResult {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
  user: ReturnType<typeof toPublicUser>;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    private readonly configService: ConfigService,
  ) {}

  async login(login: string, password: string): Promise<LoginResult> {
    const normalized = (login || '').trim().toLowerCase();
    if (!normalized || !password) {
      throw new BadRequestException('Вкажіть логін та пароль');
    }

    const user = await this.users.findOne({
      where: [{ email: normalized }, { username: normalized }],
    });

    // Constant-ish response for unknown user / wrong password.
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Невірний логін або пароль');
    }
    if (user.status && user.status !== 'ACTIVE') {
      const reason = user.status === 'EXPELLED' ? 'відраховано' : 'академічна відпустка';
      throw new UnauthorizedException(`Обліковий запис неактивний: ${reason}`);
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Невірний логін або пароль');
    }

    user.lastLoginAt = new Date();
    await this.users.save(user);

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.fullName,
      username: user.username,
    };

    return {
      accessToken: signAccessToken(payload, this.secret, this.expiresIn),
      tokenType: 'Bearer',
      expiresIn: this.expiresIn,
      user: toPublicUser(user),
    };
  }

  async findById(id: string) {
    const user = await this.users.findOne({ where: { id } });
    return user ? toPublicUser(user) : null;
  }

  async listUsers() {
    const users = await this.users.find({ order: { createdAt: 'ASC' } });
    return users.map(toPublicUser);
  }

  /** Публічний довідник для вибору отримувача повідомлення. */
  async directory() {
    const users = await this.users.find({ where: { isActive: true }, order: { fullName: 'ASC' } });
    return users.map((user) => ({
      id: user.id,
      fullName: user.fullName,
      role: user.role,
      department: user.department,
    }));
  }

  async createUser(input: {
    email: string;
    password: string;
    fullName: string;
    role?: UserRole;
    username?: string;
    department?: string;
  }) {
    const email = (input.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) throw new BadRequestException('Некоректний email');
    if (!input.password || input.password.length < 6) {
      throw new BadRequestException('Пароль має містити щонайменше 6 символів');
    }
    const existing = await this.users.findOne({ where: [{ email }, { username: (input.username || '').toLowerCase() }] });
    if (existing) throw new BadRequestException('Користувач з таким email або логіном вже існує');

    const user = this.users.create({
      id: crypto.randomUUID(),
      email,
      username: input.username ? input.username.trim().toLowerCase() : null,
      passwordHash: await bcrypt.hash(input.password, 12),
      fullName: input.fullName?.trim() || email,
      role: input.role || UserRole.STUDENT,
      department: input.department?.trim() || null,
      isActive: true,
      status: 'ACTIVE',
    });
    const saved = await this.users.save(user);
    this.logger.log(`Created user ${saved.email} with role ${saved.role}`);
    return toPublicUser(saved);
  }

  async updateStatus(userId: string, status: 'ACTIVE' | 'EXPELLED' | 'ACADEMIC_LEAVE') {
    const user = await this.users.findOneBy({ id: userId });
    if (!user) throw new BadRequestException('Користувача не знайдено');
    user.status = status;
    const saved = await this.users.save(user);
    return toPublicUser(saved);
  }

  async updateProfile(
    userId: string,
    input: { fullName?: string; email?: string; username?: string; department?: string },
  ) {
    const user = await this.users.findOneBy({ id: userId });
    if (!user) throw new BadRequestException('Користувача не знайдено');

    if (input.fullName !== undefined) {
      const fullName = input.fullName.trim();
      if (!fullName) throw new BadRequestException('ПІБ не може бути порожнім');
      user.fullName = fullName;
    }

    if (input.email !== undefined) {
      const email = input.email.trim().toLowerCase();
      if (!email || !email.includes('@')) throw new BadRequestException('Некоректний email');
      const existing = await this.users.findOne({ where: { email } });
      if (existing && existing.id !== userId) {
        throw new BadRequestException('Цей email вже використовується');
      }
      user.email = email;
    }

    if (input.username !== undefined) {
      const username = input.username.trim().toLowerCase();
      if (!username) {
        user.username = null;
      } else {
        if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
          throw new BadRequestException('Логін: 3–32 символи, лише латиниця, цифри, крапка, дефіс або _');
        }
        const existing = await this.users.findOne({ where: { username } });
        if (existing && existing.id !== userId) {
          throw new BadRequestException('Цей логін вже зайнятий');
        }
        user.username = username;
      }
    }

    if (input.department !== undefined) {
      user.department = input.department.trim() || null;
    }

    const saved = await this.users.save(user);
    return toPublicUser(saved);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.users.findOneBy({ id: userId });
    if (!user) throw new BadRequestException('Користувача не знайдено');
    if (!currentPassword || !newPassword) {
      throw new BadRequestException('Вкажіть поточний і новий пароль');
    }
    if (newPassword.length < 6) {
      throw new BadRequestException('Новий пароль має містити щонайменше 6 символів');
    }
    if (currentPassword === newPassword) {
      throw new BadRequestException('Новий пароль має відрізнятися від поточного');
    }
    const matches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!matches) throw new BadRequestException('Поточний пароль неправильний');
    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await this.users.save(user);
    return { ok: true };
  }

  async updateUser(
    userId: string,
    input: {
      fullName?: string;
      email?: string;
      username?: string;
      department?: string;
      role?: UserRole;
      status?: 'ACTIVE' | 'EXPELLED' | 'ACADEMIC_LEAVE';
    },
  ) {
    const user = await this.users.findOneBy({ id: userId });
    if (!user) throw new BadRequestException('Користувача не знайдено');

    if (input.fullName !== undefined) {
      const fullName = input.fullName.trim();
      if (!fullName) throw new BadRequestException('ПІБ не може бути порожнім');
      user.fullName = fullName;
    }
    if (input.email !== undefined) {
      const email = input.email.trim().toLowerCase();
      if (!email || !email.includes('@')) throw new BadRequestException('Некоректний email');
      const existing = await this.users.findOne({ where: { email } });
      if (existing && existing.id !== userId) {
        throw new BadRequestException('Цей email вже використовується');
      }
      user.email = email;
    }
    if (input.username !== undefined) {
      const username = input.username.trim().toLowerCase();
      if (!username) {
        user.username = null;
      } else {
        const existing = await this.users.findOne({ where: { username } });
        if (existing && existing.id !== userId) {
          throw new BadRequestException('Цей логін вже зайнятий');
        }
        user.username = username;
      }
    }
    if (input.department !== undefined) {
      user.department = input.department.trim() || null;
    }
    if (input.role !== undefined) {
      if (![UserRole.STUDENT, UserRole.TEACHER, UserRole.ADMIN].includes(input.role)) {
        throw new BadRequestException('Некоректна роль');
      }
      user.role = input.role;
    }
    if (input.status !== undefined) {
      if (!['ACTIVE', 'EXPELLED', 'ACADEMIC_LEAVE'].includes(input.status)) {
        throw new BadRequestException('Некоректний статус');
      }
      user.status = input.status;
    }

    const saved = await this.users.save(user);
    this.logger.log(`Updated user ${saved.email}`);
    return toPublicUser(saved);
  }

  async resetPassword(userId: string, password: string) {
    if (!password || password.length < 6) {
      throw new BadRequestException('Пароль має містити щонайменше 6 символів');
    }
    const user = await this.users.findOneBy({ id: userId });
    if (!user) throw new BadRequestException('Користувача не знайдено');
    user.passwordHash = await bcrypt.hash(password, 12);
    await this.users.save(user);
    return { ok: true };
  }

  private get secret(): string {
    return this.configService.get<string>('JWT_SECRET', 'change_me_super_long_random_secret_at_least_32_chars');
  }

  private get expiresIn(): string {
    return this.configService.get<string>('JWT_EXPIRES_IN', '8h');
  }
}
