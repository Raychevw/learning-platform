import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MessageEntity } from './messages/message.entity.js';
import { MessagesService } from './messages/messages.service.js';
import { MessagesController } from './messages/messages.controller.js';
import { AuthGuard } from './messages/message.guard.js';
import { HealthController } from './presentation/controllers/HealthController.js';
import { Init1730000000000 } from './database/migrations/1730000000000-init.js';
import { Announcements1730000000001 } from './database/migrations/1730000000001-announcements.js';
import { AnnouncementEntity } from './announcements/announcement.entity.js';
import { AnnouncementsService } from './announcements/announcements.service.js';
import { AnnouncementsController } from './announcements/announcements.controller.js';

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
        database: configService.get<string>('DB_NAME', 'communication_db'),
        entities: [MessageEntity, AnnouncementEntity],
        migrations: [Init1730000000000, Announcements1730000000001],
        migrationsRun: true,
        synchronize: false,
        retryAttempts: 5,
        retryDelay: 1500,
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([MessageEntity, AnnouncementEntity]),
  ],
  controllers: [HealthController, MessagesController, AnnouncementsController],
  providers: [MessagesService, AnnouncementsService, { provide: APP_GUARD, useClass: AuthGuard }],
})
export class CommunicationModule {}
