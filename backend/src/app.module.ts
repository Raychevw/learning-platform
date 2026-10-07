import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CourseEntity } from './infrastructure/database/entities/CourseEntity.js';
import { PresentationModule } from './presentation/presentation.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get<string>('DB_USER', 'admin'),
        password: configService.get<string>('DB_PASSWORD', 'password'),
        database: configService.get<string>('DB_NAME', 'learning_platform'),
        autoLoadEntities: true,
        synchronize: true, // Внимание: тільки для розробки
        entities: [CourseEntity],
      }),
      inject: [ConfigService],
    }),
    PresentationModule,
  ],
})
export class AppModule {}
