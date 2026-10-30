import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuditLogEntity } from './audit/audit.entity.js';
import { AuditService } from './audit/audit.service.js';
import { AuditController } from './audit/audit.controller.js';
import { AuthGuard } from './audit/audit.guard.js';
import { HealthController } from './presentation/controllers/HealthController.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres' as const,
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: Number(configService.get<number>('DB_PORT', 5432)),
        username: configService.get<string>('DB_USER', 'postgres'),
        password: configService.get<string>('DB_PASSWORD', 'postgres'),
        database: configService.get<string>('DB_NAME', 'audit_db'),
        entities: [AuditLogEntity],
        synchronize: true,
        retryAttempts: 5,
        retryDelay: 1500,
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([AuditLogEntity]),
  ],
  controllers: [HealthController, AuditController],
  providers: [AuditService, { provide: APP_GUARD, useClass: AuthGuard }],
})
export class AuditModule {}
