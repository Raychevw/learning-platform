import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Student } from '../../../domain/student/Student.js';
import { IStudentRepository } from '../../../domain/student/StudentRepository.interface.js';
import { StudentEntity } from '../entities/StudentEntity.js';

@Injectable()
export class StudentRepositoryImpl implements IStudentRepository {
  constructor(
    @InjectRepository(StudentEntity)
    private readonly typeOrmRepository: Repository<StudentEntity>,
  ) {}

  async save(student: Student): Promise<void> {
    const entity = new StudentEntity();
    entity.id = student.getId();
    entity.name = student.getName();
    entity.email = student.getEmail();
    entity.enrolledCourseIds = student.getEnrolledCourseIds();
    
    await this.typeOrmRepository.save(entity);
  }

  async findById(id: string): Promise<Student | null> {
    const entity = await this.typeOrmRepository.findOne({ where: { id } });
    if (!entity) return null;
    return Student.restore(entity.id, entity.name, entity.email, entity.enrolledCourseIds);
  }

  async findByEmail(email: string): Promise<Student | null> {
    const entity = await this.typeOrmRepository.findOne({ where: { email } });
    if (!entity) return null;
    return Student.restore(entity.id, entity.name, entity.email, entity.enrolledCourseIds);
  }
}
