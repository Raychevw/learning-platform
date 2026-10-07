import { Student } from './Student.js';

export const STUDENT_REPOSITORY_TOKEN = Symbol('STUDENT_REPOSITORY_TOKEN');

export interface IStudentRepository {
  save(student: Student): Promise<void>;
  findById(id: string): Promise<Student | null>;
  findByEmail(email: string): Promise<Student | null>;
}
