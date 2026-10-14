import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CourseEntity } from '../../infrastructure/database/entities/CourseEntity.js';
import { CourseModuleEntity } from '../../infrastructure/database/entities/CourseModuleEntity.js';
import { LessonEntity } from '../../infrastructure/database/entities/LessonEntity.js';
import { LessonCompletionEntity } from '../../infrastructure/database/entities/LessonCompletionEntity.js';
import { CourseService } from './course.service.js';
import { CourseController } from './course.controller.js';
import { S3StorageService } from '../../infrastructure/storage/S3StorageService.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([CourseEntity, CourseModuleEntity, LessonEntity, LessonCompletionEntity]),
    AuditModule,
  ],
  controllers: [CourseController],
  providers: [CourseService, S3StorageService],
  exports: [CourseService, S3StorageService],
})
export class CourseModule {}
