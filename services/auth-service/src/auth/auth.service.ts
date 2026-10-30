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

  private get secret(): string {
    return this.configService.get<string>('JWT_SECRET', 'change_me_super_long_random_secret_at_least_32_chars');
  }

  private get expiresIn(): string {
    return this.configService.get<string>('JWT_EXPIRES_IN', '8h');
  }
}
