import { Module, Logger } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { newDb, DataType } from 'pg-mem';
import crypto from 'crypto';

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

const allEntities = [
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
];

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
        synchronize: true,
        entities: allEntities,
      }),
      dataSourceFactory: async (options) => {
        if (!options) throw new Error('Invalid options passed');
        const logger = new Logger('DatabaseFactory');
        const isRemoteHost = process.env.DB_HOST && process.env.DB_HOST !== 'localhost' && process.env.DB_HOST !== '127.0.0.1';

        if (isRemoteHost) {
          logger.log(`Connecting to external PostgreSQL database at ${process.env.DB_HOST}...`);
          const dataSource = new DataSource(options);
          return dataSource.initialize();
        }

        try {
          const dataSource = new DataSource(options);
          const initialized = await dataSource.initialize();
          logger.log(`Connected to local PostgreSQL database`);
          return initialized;
        } catch (err) {
          logger.warn(`Could not connect to local PostgreSQL (${(err as Error).message}). Using In-Memory PostgreSQL engine (pg-mem).`);
          const db = newDb({ autoCreateForeignKeyIndices: true });
          db.public.registerFunction({ implementation: () => 'lms_db', name: 'current_database' });
          db.public.registerFunction({ implementation: () => 'PostgreSQL 15.0', name: 'version' });
          db.public.registerFunction({
            name: 'quote_ident',
            args: [DataType.text],
            returns: DataType.text,
            implementation: (str: string) => `"${str}"`,
          });
          db.public.registerFunction({
            name: 'obj_description',
            args: [DataType.regclass, DataType.text],
            returns: DataType.text,
            implementation: () => null,
          });
          db.public.registerFunction({
            name: 'obj_description',
            args: [DataType.integer, DataType.text],
            returns: DataType.text,
            implementation: () => null,
          });
          db.public.registerFunction({
            name: 'uuid_generate_v4',
            returns: DataType.uuid,
            implementation: () => crypto.randomUUID(),
          });
          const ds = db.adapters.createTypeormDataSource({
            ...options,
            entities: allEntities,
            synchronize: true,
          });
          return ds.initialize();
        }
      },
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
