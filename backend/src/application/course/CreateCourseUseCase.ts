import { Injectable, Inject } from '@nestjs/common';
import { Course } from '../../domain/course/Course.js';
import { COURSE_REPOSITORY_TOKEN } from '../../domain/course/CourseRepository.interface.js';
import type { ICourseRepository } from '../../domain/course/CourseRepository.interface.js';
import { randomUUID } from 'crypto';

@Injectable()
export class CreateCourseUseCase {
  constructor(
    @Inject(COURSE_REPOSITORY_TOKEN)
    private readonly courseRepository: ICourseRepository,
  ) {}

  async execute(title: string, description: string): Promise<Course> {
    const courseId = randomUUID();
    const course = Course.create(courseId, title, description);
    
    await this.courseRepository.save(course);
    
    return course;
  }
}
