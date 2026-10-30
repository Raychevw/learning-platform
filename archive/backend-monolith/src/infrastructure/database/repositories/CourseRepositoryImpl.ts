import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Course } from '../../../domain/course/Course.js';
import { ICourseRepository } from '../../../domain/course/CourseRepository.interface.js';
import { CourseEntity } from '../entities/CourseEntity.js';

@Injectable()
export class CourseRepositoryImpl implements ICourseRepository {
  constructor(
    @InjectRepository(CourseEntity)
    private readonly typeOrmRepository: Repository<CourseEntity>,
  ) {}

  async save(course: Course): Promise<void> {
    const entity = new CourseEntity();
    entity.id = course.getId();
    entity.title = course.getTitle();
    entity.description = course.getDescription();
    entity.isPublished = course.getIsPublished();
    
    await this.typeOrmRepository.save(entity);
  }

  async findById(id: string): Promise<Course | null> {
    const entity = await this.typeOrmRepository.findOne({ where: { id } });
    if (!entity) return null;
    
    return Course.restore(entity.id, entity.title, entity.description, entity.isPublished);
  }

  async findAll(): Promise<Course[]> {
    const entities = await this.typeOrmRepository.find();
    return entities.map(entity => 
      Course.restore(entity.id, entity.title, entity.description, entity.isPublished)
    );
  }
}
