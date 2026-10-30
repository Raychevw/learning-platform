import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../../infrastructure/database/entities/UserEntity.js';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { RolesGuard } from './roles.guard.js';
import { OwnershipGuard } from './ownership.guard.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity]), AuditModule],
  controllers: [AuthController],
  providers: [AuthService, RolesGuard, OwnershipGuard],
  exports: [AuthService, RolesGuard, OwnershipGuard],
})
export class AuthModule {}
