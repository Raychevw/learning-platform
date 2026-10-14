import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssignmentEntity } from '../../infrastructure/database/entities/AssignmentEntity.js';
import { SubmissionEntity } from '../../infrastructure/database/entities/SubmissionEntity.js';
import { RubricEntity } from '../../infrastructure/database/entities/RubricEntity.js';
import { AssignmentService } from './assignment.service.js';
import { AssignmentController } from './assignment.controller.js';
import { S3StorageService } from '../../infrastructure/storage/S3StorageService.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([AssignmentEntity, SubmissionEntity, RubricEntity]),
    AuditModule,
  ],
  controllers: [AssignmentController],
  providers: [AssignmentService, S3StorageService],
  exports: [AssignmentService],
})
export class AssignmentModule {}
