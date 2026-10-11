import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { COURSE_REPOSITORY_TOKEN } from '../../domain/course/CourseRepository.interface.js';
import type { ICourseRepository } from '../../domain/course/CourseRepository.interface.js';

@Injectable()
export class GetCourseUseCase {
  constructor(
    @Inject(COURSE_REPOSITORY_TOKEN)
    private readonly courseRepository: ICourseRepository,
  ) {}

  async execute(courseId: string) {
    const course = await this.courseRepository.findById(courseId);
    if (!course) {
      throw new NotFoundException(`Course with ID ${courseId} not found`);
    }
    return {
      id: course.getId(),
      title: course.getTitle(),
      description: course.getDescription(),
      isPublished: course.getIsPublished(),
    };
  }
}

@Injectable()
export class ListCoursesUseCase {
  constructor(
    @Inject(COURSE_REPOSITORY_TOKEN)
    private readonly courseRepository: ICourseRepository,
  ) {}

  async execute() {
    const courses = await this.courseRepository.findAll();
    return courses.map((course) => ({
      id: course.getId(),
      title: course.getTitle(),
      description: course.getDescription(),
      isPublished: course.getIsPublished(),
    }));
  }
}
