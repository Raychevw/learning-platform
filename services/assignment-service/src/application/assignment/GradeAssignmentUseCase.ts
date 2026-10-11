import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { ASSIGNMENT_REPOSITORY_TOKEN } from '../../domain/assignment/AssignmentRepository.interface.js';
import type { IAssignmentRepository } from '../../domain/assignment/AssignmentRepository.interface.js';
import { IGradingStrategy } from '../../domain/assignment/strategies/GradingStrategy.interface.js';
import { StandardGradingStrategy } from '../../domain/assignment/strategies/StandardGradingStrategy.js';
import { LatePenaltyGradingStrategy } from '../../domain/assignment/strategies/LatePenaltyGradingStrategy.js';
import { ExcellenceBonusGradingStrategy } from '../../domain/assignment/strategies/ExcellenceBonusGradingStrategy.js';

export interface GradeAssignmentCommand {
  assignmentId: string;
  studentId: string;
  rawScore: number;
  submittedAt: string;
  strategyName?: 'STANDARD' | 'LATE_PENALTY' | 'EXCELLENCE_BONUS';
}

@Injectable()
export class GradeAssignmentUseCase {
  private readonly strategies: Map<string, IGradingStrategy> = new Map();

  constructor(
    @Inject(ASSIGNMENT_REPOSITORY_TOKEN)
    private readonly assignmentRepository: IAssignmentRepository,
  ) {
    // Register available strategies (extensible without modifying execution logic)
    const standard = new StandardGradingStrategy();
    const latePenalty = new LatePenaltyGradingStrategy();
    const bonus = new ExcellenceBonusGradingStrategy();

    this.strategies.set(standard.name, standard);
    this.strategies.set(latePenalty.name, latePenalty);
    this.strategies.set(bonus.name, bonus);
  }

  async execute(command: GradeAssignmentCommand) {
    const assignment = await this.assignmentRepository.findById(command.assignmentId);
    if (!assignment) {
      throw new NotFoundException(`Assignment ${command.assignmentId} not found`);
    }

    const strategyKey = command.strategyName || 'STANDARD';
    const strategy = this.strategies.get(strategyKey);

    if (!strategy) {
      throw new BadRequestException(`Unknown grading strategy: ${strategyKey}`);
    }

    const finalScore = strategy.calculateFinalScore({
      rawScore: command.rawScore,
      maxScore: assignment.getMaxScore(),
      submittedAt: new Date(command.submittedAt),
      dueDate: assignment.getDueDate(),
    });

    return {
      assignmentId: assignment.getId(),
      studentId: command.studentId,
      rawScore: command.rawScore,
      finalScore,
      maxScore: assignment.getMaxScore(),
      strategyUsed: strategy.name,
      gradedAt: new Date().toISOString(),
    };
  }
}
