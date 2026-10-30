import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GradeEntity } from '../../infrastructure/database/entities/GradeEntity.js';
import { SubmissionEntity } from '../../infrastructure/database/entities/SubmissionEntity.js';
import { GradingService } from './grading.service.js';
import { GradingController } from './grading.controller.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([GradeEntity, SubmissionEntity]), AuditModule],
  controllers: [GradingController],
  providers: [GradingService],
  exports: [GradingService],
})
export class GradingModule {}
