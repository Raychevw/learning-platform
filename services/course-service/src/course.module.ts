import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CourseEntity } from './infrastructure/database/entities/CourseEntity.js';
import { CourseRepositoryImpl } from './infrastructure/database/repositories/CourseRepositoryImpl.js';
import { InMemoryCourseRepository } from './infrastructure/database/repositories/InMemoryCourseRepository.js';
import { COURSE_REPOSITORY_TOKEN } from './domain/course/CourseRepository.interface.js';
import { EVENT_PUBLISHER_TOKEN } from './application/course/EventPublisher.interface.js';
import { RedisEventPublisher } from './infrastructure/events/RedisEventPublisher.js';
import { CreateCourseUseCase } from './application/course/CreateCourseUseCase.js';
import { PublishCourseUseCase } from './application/course/PublishCourseUseCase.js';
import { GetCourseUseCase, ListCoursesUseCase } from './application/course/GetCourseUseCase.js';
import { CourseController } from './presentation/controllers/CourseController.js';

const usePostgres = process.env.USE_POSTGRES !== 'false';

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
        entities: [CourseEntity],
        synchronize: true,
        retryAttempts: 2,
        retryDelay: 1000,
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([CourseEntity]),
  );
}

@Module({
  imports: dynamicImports,
  controllers: [CourseController],
  providers: [
    {
      provide: COURSE_REPOSITORY_TOKEN,
      useClass: usePostgres ? CourseRepositoryImpl : InMemoryCourseRepository,
    },
    { provide: EVENT_PUBLISHER_TOKEN, useClass: RedisEventPublisher },
    CreateCourseUseCase,
    PublishCourseUseCase,
    GetCourseUseCase,
    ListCoursesUseCase,
  ],
})
export class CourseModule {}
