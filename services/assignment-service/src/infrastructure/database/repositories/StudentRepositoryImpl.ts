import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Student } from '../../../domain/student/Student.js';
import type { IStudentRepository } from '../../../domain/student/StudentRepository.interface.js';
import { StudentEntity } from '../entities/StudentEntity.js';

@Injectable()
export class StudentRepositoryImpl implements IStudentRepository {
  constructor(
    @InjectRepository(StudentEntity)
    private readonly repository: Repository<StudentEntity>,
  ) {}

  async save(student: Student): Promise<void> {
    const entity = new StudentEntity();
    entity.id = student.getId();
    entity.name = student.getName();
    entity.email = student.getEmail();
    entity.enrolledCourseIds = student.getEnrolledCourseIds();

    await this.repository.save(entity);
  }

  async findById(id: string): Promise<Student | null> {
    const entity = await this.repository.findOneBy({ id });
    if (!entity) return null;

    return Student.restore(
      entity.id,
      entity.name,
      entity.email,
      entity.enrolledCourseIds || [],
    );
  }

  async findAll(): Promise<Student[]> {
    const entities = await this.repository.find();
    return entities.map((entity) =>
      Student.restore(
        entity.id,
        entity.name,
        entity.email,
        entity.enrolledCourseIds || [],
      ),
    );
  }
}
