import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CourseEntity } from './entities/CourseEntity.js';
import { CourseRepositoryImpl } from './repositories/CourseRepositoryImpl.js';
import { COURSE_REPOSITORY_TOKEN } from '../../domain/course/CourseRepository.interface.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([CourseEntity]),
  ],
  providers: [
    {
      provide: COURSE_REPOSITORY_TOKEN,
      useClass: CourseRepositoryImpl,
    },
  ],
  exports: [
    COURSE_REPOSITORY_TOKEN,
  ],
})
export class DatabaseModule {}
