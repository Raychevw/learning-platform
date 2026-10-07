import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Assignment } from '../../../domain/assignment/Assignment.js';
import { IAssignmentRepository } from '../../../domain/assignment/AssignmentRepository.interface.js';
import { AssignmentEntity } from '../entities/AssignmentEntity.js';

@Injectable()
export class AssignmentRepositoryImpl implements IAssignmentRepository {
  constructor(
    @InjectRepository(AssignmentEntity)
    private readonly typeOrmRepository: Repository<AssignmentEntity>,
  ) {}

  async save(assignment: Assignment): Promise<void> {
    const entity = new AssignmentEntity();
    entity.id = assignment.getId();
    entity.courseId = assignment.getCourseId();
    entity.title = assignment.getTitle();
    entity.maxScore = assignment.getMaxScore();
    entity.dueDate = assignment.getDueDate();
    
    await this.typeOrmRepository.save(entity);
  }

  async findById(id: string): Promise<Assignment | null> {
    const entity = await this.typeOrmRepository.findOne({ where: { id } });
    if (!entity) return null;
    return Assignment.restore(entity.id, entity.courseId, entity.title, entity.maxScore, entity.dueDate);
  }

  async findByCourseId(courseId: string): Promise<Assignment[]> {
    const entities = await this.typeOrmRepository.find({ where: { courseId } });
    return entities.map(entity => 
      Assignment.restore(entity.id, entity.courseId, entity.title, entity.maxScore, entity.dueDate)
    );
  }
}
