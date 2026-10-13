import { Injectable } from '@nestjs/common';
import { Assignment } from '../../../domain/assignment/Assignment.js';
import type { IAssignmentRepository } from '../../../domain/assignment/AssignmentRepository.interface.js';

@Injectable()
export class InMemoryAssignmentRepository implements IAssignmentRepository {
  private readonly assignments: Map<string, Assignment> = new Map();

  async save(assignment: Assignment): Promise<void> {
    this.assignments.set(assignment.getId(), assignment);
  }

  async findById(id: string): Promise<Assignment | null> {
    return this.assignments.get(id) || null;
  }

  async findByCourseId(courseId: string): Promise<Assignment[]> {
    return Array.from(this.assignments.values()).filter((a) => a.getCourseId() === courseId);
  }

  async findAll(): Promise<Assignment[]> {
    return Array.from(this.assignments.values());
  }
}
