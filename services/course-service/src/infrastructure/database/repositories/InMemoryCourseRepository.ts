import { Injectable } from '@nestjs/common';
import { Course } from '../../../domain/course/Course.js';
import type { ICourseRepository } from '../../../domain/course/CourseRepository.interface.js';

@Injectable()
export class InMemoryCourseRepository implements ICourseRepository {
  private readonly courses: Map<string, Course> = new Map();

  async save(course: Course): Promise<void> {
    this.courses.set(course.getId(), course);
  }

  async findById(id: string): Promise<Course | null> {
    return this.courses.get(id) || null;
  }

  async findAll(): Promise<Course[]> {
    return Array.from(this.courses.values());
  }
}
