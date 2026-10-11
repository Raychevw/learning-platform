import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { Assignment } from '../../domain/assignment/Assignment.js';
import { ASSIGNMENT_REPOSITORY_TOKEN } from '../../domain/assignment/AssignmentRepository.interface.js';
import type { IAssignmentRepository } from '../../domain/assignment/AssignmentRepository.interface.js';
import { COURSE_SERVICE_CLIENT_TOKEN } from '../../infrastructure/clients/CourseServiceClient.js';
import type { ICourseServiceClient } from '../../infrastructure/clients/CourseServiceClient.js';

export interface CreateAssignmentCommand {
  id?: string;
  courseId: string;
  title: string;
  maxScore: number;
  dueDate: string;
}

@Injectable()
export class CreateAssignmentUseCase {
  constructor(
    @Inject(ASSIGNMENT_REPOSITORY_TOKEN)
    private readonly assignmentRepository: IAssignmentRepository,
    @Inject(COURSE_SERVICE_CLIENT_TOKEN)
    private readonly courseServiceClient: ICourseServiceClient,
  ) {}

  async execute(command: CreateAssignmentCommand) {
    const id = command.id || crypto.randomUUID();
    const dueDateObj = new Date(command.dueDate);

    // Synchronous call to Course Service (protected with 2s timeout & graceful degradation fallback)
    const courseInfo = await this.courseServiceClient.getCourse(command.courseId);

    try {
      const assignment = Assignment.create(
        id,
        command.courseId,
        courseInfo.title,
        command.title,
        command.maxScore,
        dueDateObj,
        courseInfo.isVerified,
      );

      await this.assignmentRepository.save(assignment);

      return {
        id: assignment.getId(),
        courseId: assignment.getCourseId(),
        courseTitle: assignment.getCourseTitle(),
        title: assignment.getTitle(),
        maxScore: assignment.getMaxScore(),
        dueDate: assignment.getDueDate().toISOString(),
        isCourseVerified: assignment.getIsCourseVerified(),
        fallbackNotice: courseInfo.fallbackNotice || null,
      };
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
  }
}

@Injectable()
export class GetAssignmentUseCase {
  constructor(
    @Inject(ASSIGNMENT_REPOSITORY_TOKEN)
    private readonly assignmentRepository: IAssignmentRepository,
  ) {}

  async execute(id: string) {
    const assignment = await this.assignmentRepository.findById(id);
    if (!assignment) {
      return null;
    }
    return {
      id: assignment.getId(),
      courseId: assignment.getCourseId(),
      courseTitle: assignment.getCourseTitle(),
      title: assignment.getTitle(),
      maxScore: assignment.getMaxScore(),
      dueDate: assignment.getDueDate().toISOString(),
      isCourseVerified: assignment.getIsCourseVerified(),
    };
  }
}

@Injectable()
export class ListAssignmentsUseCase {
  constructor(
    @Inject(ASSIGNMENT_REPOSITORY_TOKEN)
    private readonly assignmentRepository: IAssignmentRepository,
  ) {}

  async execute() {
    const assignments = await this.assignmentRepository.findAll();
    return assignments.map((a) => ({
      id: a.getId(),
      courseId: a.getCourseId(),
      courseTitle: a.getCourseTitle(),
      title: a.getTitle(),
      maxScore: a.getMaxScore(),
      dueDate: a.getDueDate().toISOString(),
      isCourseVerified: a.getIsCourseVerified(),
    }));
  }
}
