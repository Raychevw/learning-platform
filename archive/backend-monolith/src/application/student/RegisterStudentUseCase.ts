import { Injectable, Inject } from '@nestjs/common';
import { Student } from '../../domain/student/Student.js';
import { STUDENT_REPOSITORY_TOKEN } from '../../domain/student/StudentRepository.interface.js';
import type { IStudentRepository } from '../../domain/student/StudentRepository.interface.js';
import { randomUUID } from 'crypto';

@Injectable()
export class RegisterStudentUseCase {
  constructor(
    @Inject(STUDENT_REPOSITORY_TOKEN)
    private readonly studentRepository: IStudentRepository,
  ) {}

  async execute(name: string, email: string): Promise<Student> {
    const existing = await this.studentRepository.findByEmail(email);
    if (existing) {
      throw new Error('Email is already registered');
    }

    const studentId = randomUUID();
    const student = Student.create(studentId, name, email);
    
    await this.studentRepository.save(student);
    
    return student;
  }
}
