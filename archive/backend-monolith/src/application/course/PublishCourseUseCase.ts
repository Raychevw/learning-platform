import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { COURSE_REPOSITORY_TOKEN } from '../../domain/course/CourseRepository.interface.js';
import type { ICourseRepository } from '../../domain/course/CourseRepository.interface.js';

@Injectable()
export class PublishCourseUseCase {
  constructor(
    @Inject(COURSE_REPOSITORY_TOKEN)
    private readonly courseRepository: ICourseRepository,
  ) {}

  async execute(courseId: string): Promise<void> {
    const course = await this.courseRepository.findById(courseId);
    
    if (!course) {
      throw new NotFoundException(`Course with ID ${courseId} not found`);
    }

    try {
      course.publish();
      await this.courseRepository.save(course);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
  }
}
