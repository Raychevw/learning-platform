import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { Course } from '../../domain/course/Course.js';
import { COURSE_REPOSITORY_TOKEN } from '../../domain/course/CourseRepository.interface.js';
import type { ICourseRepository } from '../../domain/course/CourseRepository.interface.js';

export interface CreateCourseCommand {
  id?: string;
  title: string;
  description: string;
}

@Injectable()
export class CreateCourseUseCase {
  constructor(
    @Inject(COURSE_REPOSITORY_TOKEN)
    private readonly courseRepository: ICourseRepository,
  ) {}

  async execute(command: CreateCourseCommand): Promise<{ id: string; title: string; description: string; isPublished: boolean }> {
    const id = command.id || crypto.randomUUID();
    try {
      const course = Course.create(id, command.title, command.description);
      await this.courseRepository.save(course);
      return {
        id: course.getId(),
        title: course.getTitle(),
        description: course.getDescription(),
        isPublished: course.getIsPublished(),
      };
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
  }
}
