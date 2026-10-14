import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebinarEntity } from '../../infrastructure/database/entities/WebinarEntity.js';
import { WebinarService } from './webinar.service.js';
import { WebinarController } from './webinar.controller.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([WebinarEntity]), AuditModule],
  controllers: [WebinarController],
  providers: [WebinarService],
  exports: [WebinarService],
})
export class WebinarModule {}
