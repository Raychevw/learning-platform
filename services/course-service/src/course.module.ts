import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CourseEntity } from './infrastructure/database/entities/CourseEntity.js';
import {
  CourseModuleEntity,
  LessonEntity,
  LessonCompletionEntity,
  WebinarEntity,
  ScheduleEntryEntity,
} from './infrastructure/database/entities/CatalogEntities.js';
import { CourseRepositoryImpl } from './infrastructure/database/repositories/CourseRepositoryImpl.js';
import { InMemoryCourseRepository } from './infrastructure/database/repositories/InMemoryCourseRepository.js';
import { COURSE_REPOSITORY_TOKEN } from './domain/course/CourseRepository.interface.js';
import { EVENT_PUBLISHER_TOKEN } from './application/course/EventPublisher.interface.js';
import { RedisEventPublisher } from './infrastructure/events/RedisEventPublisher.js';
import { CreateCourseUseCase } from './application/course/CreateCourseUseCase.js';
import { PublishCourseUseCase } from './application/course/PublishCourseUseCase.js';
import { GetCourseUseCase, ListCoursesUseCase } from './application/course/GetCourseUseCase.js';
import { CourseController } from './presentation/controllers/CourseController.js';
import { CatalogService } from './catalog/catalog.service.js';
import { CatalogController, WebinarController, ScheduleController } from './catalog/catalog.controller.js';
import { CatalogSeeder, ScheduleSeeder } from './catalog/catalog.seeder.js';
import { WebinarEventsService } from './catalog/webinar-events.service.js';
import { HealthController } from './presentation/controllers/HealthController.js';
import { AuthGuard } from './auth/auth.guard.js';
import { Init1730000000000 } from './database/migrations/1730000000000-init.js';
import { Schedule1730000000001 } from './database/migrations/1730000000001-schedule.js';
import { LessonMaterials1730000000002 } from './database/migrations/1730000000002-lesson-materials.js';
import { CourseOwner1730000000003 } from './database/migrations/1730000000003-course-owner.js';
import { STORAGE_SERVICE_TOKEN, createStorageService } from './infrastructure/storage/storage.service.js';

const usePostgres = process.env.USE_POSTGRES !== 'false';

const ALL_ENTITIES = [
  CourseEntity,
  CourseModuleEntity,
  LessonEntity,
  LessonCompletionEntity,
  WebinarEntity,
  ScheduleEntryEntity,
];

const dynamicImports: any[] = [
  ConfigModule.forRoot({
    isGlobal: true,
  }),
];

if (usePostgres) {
  dynamicImports.push(
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: Number(configService.get<number>('DB_PORT', 5432)),
        username: configService.get<string>('DB_USER', 'postgres'),
        password: configService.get<string>('DB_PASSWORD', 'postgres'),
        database: configService.get<string>('DB_NAME', 'course_db'),
        entities: ALL_ENTITIES,
        migrations: [
          Init1730000000000,
          Schedule1730000000001,
          LessonMaterials1730000000002,
          CourseOwner1730000000003,
        ],
        migrationsRun: true,
        synchronize: false,
        retryAttempts: 2,
        retryDelay: 1000,
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature(ALL_ENTITIES),
  );
}

// Catalog (modules, lessons, progress) and webinars require PostgreSQL
const catalogControllers = usePostgres ? [CatalogController, WebinarController, ScheduleController] : [];
const catalogProviders = usePostgres ? [CatalogService, CatalogSeeder, ScheduleSeeder, WebinarEventsService] : [];

@Module({
  imports: dynamicImports,
  controllers: [HealthController, CourseController, ...catalogControllers],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    {
      provide: STORAGE_SERVICE_TOKEN,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => createStorageService(configService),
    },
    {
      provide: COURSE_REPOSITORY_TOKEN,
      useClass: usePostgres ? CourseRepositoryImpl : InMemoryCourseRepository,
    },
    { provide: EVENT_PUBLISHER_TOKEN, useClass: RedisEventPublisher },
    CreateCourseUseCase,
    PublishCourseUseCase,
    GetCourseUseCase,
    ListCoursesUseCase,
    ...catalogProviders,
  ],
})
export class CourseModule {}
