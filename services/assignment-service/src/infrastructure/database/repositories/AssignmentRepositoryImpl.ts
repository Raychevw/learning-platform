import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Assignment } from '../../../domain/assignment/Assignment.js';
import type { IAssignmentRepository } from '../../../domain/assignment/AssignmentRepository.interface.js';
import { AssignmentEntity } from '../entities/AssignmentEntity.js';

@Injectable()
export class AssignmentRepositoryImpl implements IAssignmentRepository {
  constructor(
    @InjectRepository(AssignmentEntity)
    private readonly repository: Repository<AssignmentEntity>,
  ) {}

  async save(assignment: Assignment): Promise<void> {
    const entity = new AssignmentEntity();
    entity.id = assignment.getId();
    entity.courseId = assignment.getCourseId();
    entity.courseTitle = assignment.getCourseTitle();
    entity.title = assignment.getTitle();
    entity.maxScore = assignment.getMaxScore();
    entity.dueDate = assignment.getDueDate();
    entity.isCourseVerified = assignment.getIsCourseVerified();

    await this.repository.save(entity);
  }

  async findById(id: string): Promise<Assignment | null> {
    const entity = await this.repository.findOneBy({ id });
    if (!entity) return null;

    return Assignment.restore(
      entity.id,
      entity.courseId,
      entity.courseTitle,
      entity.title,
      entity.maxScore,
      entity.dueDate,
      entity.isCourseVerified,
    );
  }

  async findByCourseId(courseId: string): Promise<Assignment[]> {
    const entities = await this.repository.findBy({ courseId });
    return entities.map((entity) =>
      Assignment.restore(
        entity.id,
        entity.courseId,
        entity.courseTitle,
        entity.title,
        entity.maxScore,
        entity.dueDate,
        entity.isCourseVerified,
      ),
    );
  }

  async findAll(): Promise<Assignment[]> {
    const entities = await this.repository.find();
    return entities.map((entity) =>
      Assignment.restore(
        entity.id,
        entity.courseId,
        entity.courseTitle,
        entity.title,
        entity.maxScore,
        entity.dueDate,
        entity.isCourseVerified,
      ),
    );
  }
}
