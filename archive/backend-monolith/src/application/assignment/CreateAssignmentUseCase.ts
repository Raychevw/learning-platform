import { Injectable, Inject } from '@nestjs/common';
import { Assignment } from '../../domain/assignment/Assignment.js';
import { ASSIGNMENT_REPOSITORY_TOKEN } from '../../domain/assignment/AssignmentRepository.interface.js';
import type { IAssignmentRepository } from '../../domain/assignment/AssignmentRepository.interface.js';
import { randomUUID } from 'crypto';

@Injectable()
export class CreateAssignmentUseCase {
  constructor(
    @Inject(ASSIGNMENT_REPOSITORY_TOKEN)
    private readonly assignmentRepository: IAssignmentRepository,
  ) {}

  async execute(courseId: string, title: string, maxScore: number, dueDate: Date): Promise<Assignment> {
    const id = randomUUID();
    const assignment = Assignment.create(id, courseId, title, maxScore, dueDate);
    
    await this.assignmentRepository.save(assignment);
    
    return assignment;
  }
}
