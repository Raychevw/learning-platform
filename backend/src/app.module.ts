import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

// 14 Domain Entities for University LMS
import {
  UserEntity,
  AcademicGroupEntity,
  StudentGroupEntity,
  CourseEntity,
  CourseGroupEntity,
  CourseModuleEntity,
  LessonEntity,
  LessonCompletionEntity,
  RubricEntity,
  AssignmentEntity,
  SubmissionEntity,
  GradeEntity,
  WebinarEntity,
  AuditLogEntity,
} from './infrastructure/database/entities/index.js';

// 7 Modular Monolith NestJS Modules
import { AuthModule } from './modules/auth/auth.module.js';
import { UsersAndGroupsModule } from './modules/users-and-groups/users-and-groups.module.js';
import { CourseModule } from './modules/course/course.module.js';
import { AssignmentModule } from './modules/assignment/assignment.module.js';
import { GradingModule } from './modules/grading/grading.module.js';
import { WebinarModule } from './modules/webinar/webinar.module.js';
import { AuditModule } from './modules/audit/audit.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get<string>('DB_USER', 'lms_admin'),
        password: configService.get<string>('DB_PASSWORD', 'lms_secure_password'),
        database: configService.get<string>('DB_NAME', 'lms_db'),
        autoLoadEntities: true,
        synchronize: true, // Auto-syncs 14 tables in development
        entities: [
          UserEntity,
          AcademicGroupEntity,
          StudentGroupEntity,
          CourseEntity,
          CourseGroupEntity,
          CourseModuleEntity,
          LessonEntity,
          LessonCompletionEntity,
          RubricEntity,
          AssignmentEntity,
          SubmissionEntity,
          GradeEntity,
          WebinarEntity,
          AuditLogEntity,
        ],
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    UsersAndGroupsModule,
    CourseModule,
    AssignmentModule,
    GradingModule,
    WebinarModule,
    AuditModule,
  ],
})
export class AppModule {}
