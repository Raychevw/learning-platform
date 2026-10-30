import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicGroupEntity } from '../../infrastructure/database/entities/AcademicGroupEntity.js';
import { StudentGroupEntity } from '../../infrastructure/database/entities/StudentGroupEntity.js';
import { CourseGroupEntity } from '../../infrastructure/database/entities/CourseGroupEntity.js';
import { UserEntity } from '../../infrastructure/database/entities/UserEntity.js';
import { UsersAndGroupsService } from './users-and-groups.service.js';
import { UsersAndGroupsController } from './users-and-groups.controller.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([AcademicGroupEntity, StudentGroupEntity, CourseGroupEntity, UserEntity]),
    AuditModule,
  ],
  controllers: [UsersAndGroupsController],
  providers: [UsersAndGroupsService],
  exports: [UsersAndGroupsService],
})
export class UsersAndGroupsModule {}
