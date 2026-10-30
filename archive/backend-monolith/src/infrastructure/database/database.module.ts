import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CourseEntity } from './entities/CourseEntity.js';
import { StudentEntity } from './entities/StudentEntity.js';
import { AssignmentEntity } from './entities/AssignmentEntity.js';
import { CourseRepositoryImpl } from './repositories/CourseRepositoryImpl.js';
import { StudentRepositoryImpl } from './repositories/StudentRepositoryImpl.js';
import { AssignmentRepositoryImpl } from './repositories/AssignmentRepositoryImpl.js';
import { COURSE_REPOSITORY_TOKEN } from '../../domain/course/CourseRepository.interface.js';
import { STUDENT_REPOSITORY_TOKEN } from '../../domain/student/StudentRepository.interface.js';
import { ASSIGNMENT_REPOSITORY_TOKEN } from '../../domain/assignment/AssignmentRepository.interface.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([CourseEntity, StudentEntity, AssignmentEntity]),
  ],
  providers: [
    { provide: COURSE_REPOSITORY_TOKEN, useClass: CourseRepositoryImpl },
    { provide: STUDENT_REPOSITORY_TOKEN, useClass: StudentRepositoryImpl },
    { provide: ASSIGNMENT_REPOSITORY_TOKEN, useClass: AssignmentRepositoryImpl },
  ],
  exports: [
    COURSE_REPOSITORY_TOKEN,
    STUDENT_REPOSITORY_TOKEN,
    ASSIGNMENT_REPOSITORY_TOKEN,
  ],
})
export class DatabaseModule {}
