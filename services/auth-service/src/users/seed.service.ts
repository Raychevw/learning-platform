import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { UserEntity } from '../users/user.entity.js';
import { UserRole } from '../users/roles.js';

const DEMO_USERS: Array<Partial<UserEntity> & { password: string; username: string; email: string }> = [
  {
    id: 'usr-student',
    email: 'o.petrenko@univ.edu.ua',
    username: 'student',
    password: '123456',
    fullName: 'Олександр Петренко',
    role: UserRole.STUDENT,
    department: 'Група ІПЗ-412 • 4 курс',
  },
  {
    id: 'usr-teacher',
    email: 'd.kovalenko@univ.edu.ua',
    username: 'teacher',
    password: '123456',
    fullName: 'Дмитро Коваленко, доц.',
    role: UserRole.TEACHER,
    department: 'Кафедра інженерії ПЗ',
  },
  {
    id: 'usr-admin',
    email: 'dekanat.fiot@univ.edu.ua',
    username: 'admin',
    password: '123456',
    fullName: 'Олена Франчук',
    role: UserRole.ADMIN,
    department: 'Деканат ФІОТ',
  },
];

/** Creates demo accounts (with hashed passwords) on first start. */
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    private readonly configService: ConfigService,
  ) {}

  async onApplicationBootstrap() {
    if (this.configService.get<string>('SEED_DEMO_DATA', 'true') === 'false') return;
    if ((await this.users.count()) > 0) return;

    const password = this.configService.get<string>('DEMO_PASSWORD', '123456');

    for (const demo of DEMO_USERS) {
      const passwordHash = await bcrypt.hash(demo.password || password, 12);
      await this.users.save(
        this.users.create({
          id: demo.id,
          email: demo.email,
          username: demo.username,
          passwordHash,
          fullName: demo.fullName,
          role: demo.role,
          department: demo.department ?? null,
          isActive: true,
        }),
      );
    }

    this.logger.log(
      `Seeded ${DEMO_USERS.length} demo accounts (student/teacher/admin). Password: ${'*'.repeat(password.length)}`,
    );
  }
}
