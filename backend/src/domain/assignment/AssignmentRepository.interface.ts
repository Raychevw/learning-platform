import { Assignment } from './Assignment.js';

export const ASSIGNMENT_REPOSITORY_TOKEN = Symbol('ASSIGNMENT_REPOSITORY_TOKEN');

export interface IAssignmentRepository {
  save(assignment: Assignment): Promise<void>;
  findById(id: string): Promise<Assignment | null>;
  findByCourseId(courseId: string): Promise<Assignment[]>;
}
