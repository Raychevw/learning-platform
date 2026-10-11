import { Injectable, Inject, BadRequestException, NotFoundException } from '@nestjs/common';
import { Student } from '../../domain/student/Student.js';
import { STUDENT_REPOSITORY_TOKEN } from '../../domain/student/StudentRepository.interface.js';
import type { IStudentRepository } from '../../domain/student/StudentRepository.interface.js';

export interface RegisterStudentCommand {
  id?: string;
  name: string;
  email: string;
}

@Injectable()
export class RegisterStudentUseCase {
  constructor(
    @Inject(STUDENT_REPOSITORY_TOKEN)
    private readonly studentRepository: IStudentRepository,
  ) {}

  async execute(command: RegisterStudentCommand) {
    const id = command.id || crypto.randomUUID();
    try {
      const student = Student.create(id, command.name, command.email);
      await this.studentRepository.save(student);
      return {
        id: student.getId(),
        name: student.getName(),
        email: student.getEmail(),
        enrolledCourses: student.getEnrolledCourseIds(),
      };
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
  }
}

@Injectable()
export class GetStudentUseCase {
  constructor(
    @Inject(STUDENT_REPOSITORY_TOKEN)
    private readonly studentRepository: IStudentRepository,
  ) {}

  async execute(id: string) {
    const student = await this.studentRepository.findById(id);
    if (!student) {
      throw new NotFoundException(`Student with ID ${id} not found`);
    }
    return {
      id: student.getId(),
      name: student.getName(),
      email: student.getEmail(),
      enrolledCourses: student.getEnrolledCourseIds(),
    };
  }
}
