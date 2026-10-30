import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UserEntity } from './users/user.entity.js';
import { SeedService } from './users/seed.service.js';
import { AuthService } from './auth/auth.service.js';
import { AuthController } from './auth/auth.controller.js';
import { AuthGuard } from './auth/auth.guard.js';
import { HealthController } from './presentation/controllers/HealthController.js';
import { Init1730000000000 } from './database/migrations/1730000000000-init.js';
import { UserStatus1730000000001 } from './database/migrations/1730000000001-user-status.js';

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
        database: configService.get<string>('DB_NAME', 'auth_db'),
        entities: [UserEntity],
        migrations: [Init1730000000000, UserStatus1730000000001],
        migrationsRun: true,
        synchronize: false,
        retryAttempts: 5,
        retryDelay: 1500,
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([UserEntity]),
  ],
  controllers: [HealthController, AuthController],
  providers: [
    AuthService,
    SeedService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AuthModule {}
