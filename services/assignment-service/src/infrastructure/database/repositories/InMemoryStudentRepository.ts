import { Injectable } from '@nestjs/common';
import { Student } from '../../../domain/student/Student.js';
import type { IStudentRepository } from '../../../domain/student/StudentRepository.interface.js';

@Injectable()
export class InMemoryStudentRepository implements IStudentRepository {
  private readonly students: Map<string, Student> = new Map();

  async save(student: Student): Promise<void> {
    this.students.set(student.getId(), student);
  }

  async findById(id: string): Promise<Student | null> {
    return this.students.get(id) || null;
  }

  async findAll(): Promise<Student[]> {
    return Array.from(this.students.values());
  }
}
