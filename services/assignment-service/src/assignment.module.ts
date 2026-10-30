import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { StudentEntity } from './infrastructure/database/entities/StudentEntity.js';
import { AssignmentEntity } from './infrastructure/database/entities/AssignmentEntity.js';
import {
  SubmissionEntity,
  GradeEntity,
  AcademicGroupEntity,
  EnrollmentEntity,
} from './infrastructure/database/entities/CourseworkEntities.js';
import { STORAGE_SERVICE_TOKEN, createStorageService } from './infrastructure/storage/storage.service.js';
import { StudentRepositoryImpl } from './infrastructure/database/repositories/StudentRepositoryImpl.js';
import { AssignmentRepositoryImpl } from './infrastructure/database/repositories/AssignmentRepositoryImpl.js';
import { InMemoryStudentRepository } from './infrastructure/database/repositories/InMemoryStudentRepository.js';
import { InMemoryAssignmentRepository } from './infrastructure/database/repositories/InMemoryAssignmentRepository.js';
import { STUDENT_REPOSITORY_TOKEN } from './domain/student/StudentRepository.interface.js';
import { ASSIGNMENT_REPOSITORY_TOKEN } from './domain/assignment/AssignmentRepository.interface.js';
import { COURSE_SERVICE_CLIENT_TOKEN, CourseServiceClient } from './infrastructure/clients/CourseServiceClient.js';
import { LoggingCourseServiceDecorator } from './infrastructure/clients/decorators/LoggingCourseServiceDecorator.js';
import { CachingCourseServiceDecorator } from './infrastructure/clients/decorators/CachingCourseServiceDecorator.js';
import { RedisEventConsumer } from './infrastructure/events/RedisEventConsumer.js';
import { RegisterStudentUseCase, GetStudentUseCase } from './application/student/RegisterStudentUseCase.js';
import { CreateAssignmentUseCase, GetAssignmentUseCase, ListAssignmentsUseCase } from './application/assignment/CreateAssignmentUseCase.js';
import { StudentController } from './presentation/controllers/StudentController.js';
import { AssignmentController } from './presentation/controllers/AssignmentController.js';
import { GradeAssignmentUseCase } from './application/assignment/GradeAssignmentUseCase.js';
import { CourseworkService } from './coursework/coursework.service.js';
import { CourseworkController } from './coursework/coursework.controller.js';
import { CourseworkSeeder } from './coursework/coursework.seeder.js';
import { HealthController } from './presentation/controllers/HealthController.js';
import { Init1730000000000 } from './database/migrations/1730000000000-init.js';
import { Specialty1730000000001 } from './database/migrations/1730000000001-specialty.js';
import { AssignmentOpening1730000000002 } from './database/migrations/1730000000002-assignment-opening.js';
import { AuthGuard } from './auth/auth.guard.js';

const usePostgres = process.env.USE_POSTGRES !== 'false';

const ALL_ENTITIES = [
  StudentEntity,
  AssignmentEntity,
  SubmissionEntity,
  GradeEntity,
  AcademicGroupEntity,
  EnrollmentEntity,
];

const dynamicImports: any[] = [
  ConfigModule.forRoot({
    isGlobal: true,
  }),
];

if (usePostgres) {
  dynamicImports.push(
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: Number(configService.get<number>('DB_PORT', 5432)),
        username: configService.get<string>('DB_USER', 'postgres'),
        password: configService.get<string>('DB_PASSWORD', 'postgres'),
        database: configService.get<string>('DB_NAME', 'assignment_db'),
        entities: ALL_ENTITIES,
        migrations: [Init1730000000000, Specialty1730000000001, AssignmentOpening1730000000002],
        migrationsRun: true,
        synchronize: false,
        retryAttempts: 2,
        retryDelay: 1000,
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature(ALL_ENTITIES),
  );
}

const courseworkControllers = usePostgres ? [CourseworkController] : [];
const courseworkProviders = usePostgres ? [CourseworkService, CourseworkSeeder] : [];

@Module({
  imports: dynamicImports,
  controllers: [HealthController, StudentController, AssignmentController, ...courseworkControllers],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    {
      provide: STORAGE_SERVICE_TOKEN,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => createStorageService(configService),
    },
    {
      provide: STUDENT_REPOSITORY_TOKEN,
      useClass: usePostgres ? StudentRepositoryImpl : InMemoryStudentRepository,
    },
    {
      provide: ASSIGNMENT_REPOSITORY_TOKEN,
      useClass: usePostgres ? AssignmentRepositoryImpl : InMemoryAssignmentRepository,
    },
    {
      provide: COURSE_SERVICE_CLIENT_TOKEN,
      useFactory: (configService: ConfigService) => {
        const baseClient = new CourseServiceClient(configService);
        const cachedClient = new CachingCourseServiceDecorator(baseClient);
        return new LoggingCourseServiceDecorator(cachedClient);
      },
      inject: [ConfigService],
    },
    RedisEventConsumer,
    RegisterStudentUseCase,
    GetStudentUseCase,
    CreateAssignmentUseCase,
    GetAssignmentUseCase,
    ListAssignmentsUseCase,
    GradeAssignmentUseCase,
    ...courseworkProviders,
  ],
})
export class AssignmentModule {}
