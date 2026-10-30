import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcryptjs';
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
    id: 'usr-student-2',
    email: 'm.shevchenko@univ.edu.ua',
    username: 'student2',
    password: '123456',
    fullName: 'Марина Шевченко',
    role: UserRole.STUDENT,
    department: 'Група ІПЗ-412 • 4 курс',
  },
  {
    id: 'usr-student-3',
    email: 'i.bondarenko@univ.edu.ua',
    username: 'student3',
    password: '123456',
    fullName: 'Ігор Бондаренко',
    role: UserRole.STUDENT,
    department: 'Група ІПЗ-412 • 4 курс',
  },
  {
    id: 'usr-student-4',
    email: 's.melnyk@univ.edu.ua',
    username: 'student4',
    password: '123456',
    fullName: 'Софія Мельник',
    role: UserRole.STUDENT,
    department: 'Група ІПЗ-411 • 4 курс',
  },
  {
    id: 'usr-student-5',
    email: 'n.kravchuk@univ.edu.ua',
    username: 'student5',
    password: '123456',
    fullName: 'Назар Кравчук',
    role: UserRole.STUDENT,
    department: 'Група ІПЗ-411 • 4 курс',
  },
  {
    id: 'usr-student-6',
    email: 'y.tkachenko@univ.edu.ua',
    username: 'student6',
    password: '123456',
    fullName: 'Юлія Ткаченко',
    role: UserRole.STUDENT,
    department: 'Група КН-301 • 3 курс',
  },
  {
    id: 'usr-student-7',
    email: 'a.honcharenko@univ.edu.ua',
    username: 'student7',
    password: '123456',
    fullName: 'Артем Гончаренко',
    role: UserRole.STUDENT,
    department: 'Група КН-301 • 3 курс',
  },
  {
    id: 'usr-student-8',
    email: 'i.savchenko@univ.edu.ua',
    username: 'student8',
    password: '123456',
    fullName: 'Ірина Савченко',
    role: UserRole.STUDENT,
    department: 'Група КН-301 • 3 курс',
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
    id: 'usr-teacher-2',
    email: 'o.gryshchenko@univ.edu.ua',
    username: 'teacher2',
    password: '123456',
    fullName: 'Олена Грищенко, ст. викл.',
    role: UserRole.TEACHER,
    department: 'Кафедра інженерії ПЗ',
  },
  {
    id: 'usr-teacher-3',
    email: 'v.melnyk@univ.edu.ua',
    username: 'teacher3',
    password: '123456',
    fullName: 'Василь Мельник, проф.',
    role: UserRole.TEACHER,
    department: 'Кафедра комп’ютерних наук',
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

/** Creates missing demo accounts (with hashed passwords) on start. */
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

    const password = this.configService.get<string>('DEMO_PASSWORD', '123456');
    let created = 0;

    for (const demo of DEMO_USERS) {
      const existing = await this.users.findOne({
        where: [{ id: demo.id }, { email: demo.email }, { username: demo.username }],
      });
      if (existing) continue;

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
      created += 1;
    }

    if (created > 0) {
      this.logger.log(
        `Seeded ${created} demo account(s); total ${DEMO_USERS.length} (students/teachers/admin). Password: ${'*'.repeat(password.length)}`,
      );
    }
  }
}
