import { Module } from '@nestjs/common';
import { CourseController } from './controllers/CourseController.js';
import { CreateCourseUseCase } from '../application/course/CreateCourseUseCase.js';
import { PublishCourseUseCase } from '../application/course/PublishCourseUseCase.js';
import { RegisterStudentUseCase } from '../application/student/RegisterStudentUseCase.js';
import { CreateAssignmentUseCase } from '../application/assignment/CreateAssignmentUseCase.js';
import { DatabaseModule } from '../infrastructure/database/database.module.js';

@Module({
  imports: [DatabaseModule],
  controllers: [CourseController],
  providers: [
    CreateCourseUseCase,
    PublishCourseUseCase,
    RegisterStudentUseCase,
    CreateAssignmentUseCase,
  ],
})
export class PresentationModule {}
