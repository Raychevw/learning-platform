import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { StudentEntity } from './infrastructure/database/entities/StudentEntity.js';
import { AssignmentEntity } from './infrastructure/database/entities/AssignmentEntity.js';
import { StudentRepositoryImpl } from './infrastructure/database/repositories/StudentRepositoryImpl.js';
import { AssignmentRepositoryImpl } from './infrastructure/database/repositories/AssignmentRepositoryImpl.js';
import { STUDENT_REPOSITORY_TOKEN } from './domain/student/StudentRepository.interface.js';
import { ASSIGNMENT_REPOSITORY_TOKEN } from './domain/assignment/AssignmentRepository.interface.js';
import { COURSE_SERVICE_CLIENT_TOKEN, CourseServiceClient } from './infrastructure/clients/CourseServiceClient.js';
import { RedisEventConsumer } from './infrastructure/events/RedisEventConsumer.js';
import { RegisterStudentUseCase, GetStudentUseCase } from './application/student/RegisterStudentUseCase.js';
import { CreateAssignmentUseCase, GetAssignmentUseCase, ListAssignmentsUseCase } from './application/assignment/CreateAssignmentUseCase.js';
import { StudentController } from './presentation/controllers/StudentController.js';
import { AssignmentController } from './presentation/controllers/AssignmentController.js';
import { GradeAssignmentUseCase } from './application/assignment/GradeAssignmentUseCase.js';

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
        port: configService.get<number>('DB_PORT', 5434),
        username: configService.get<string>('DB_USER', 'admin'),
        password: configService.get<string>('DB_PASSWORD', 'password'),
        database: configService.get<string>('DB_NAME', 'assignment_db'),
        entities: [StudentEntity, AssignmentEntity],
        synchronize: true, // Lab development only
        retryAttempts: 2,
        retryDelay: 1000,
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([StudentEntity, AssignmentEntity]),
  ],
  controllers: [StudentController, AssignmentController],
  providers: [
    { provide: STUDENT_REPOSITORY_TOKEN, useClass: StudentRepositoryImpl },
    { provide: ASSIGNMENT_REPOSITORY_TOKEN, useClass: AssignmentRepositoryImpl },
    { provide: COURSE_SERVICE_CLIENT_TOKEN, useClass: CourseServiceClient },
    RedisEventConsumer,
    RegisterStudentUseCase,
    GetStudentUseCase,
    CreateAssignmentUseCase,
    GetAssignmentUseCase,
    ListAssignmentsUseCase,
    GradeAssignmentUseCase,
  ],
})
export class AssignmentModule {}
