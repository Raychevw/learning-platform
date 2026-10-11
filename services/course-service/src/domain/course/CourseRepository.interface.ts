import { Course } from './Course.js';

export const COURSE_REPOSITORY_TOKEN = Symbol('COURSE_REPOSITORY_TOKEN');

export interface ICourseRepository {
  save(course: Course): Promise<void>;
  findById(id: string): Promise<Course | null>;
  findAll(): Promise<Course[]>;
}
