import { IGradingStrategy, SubmissionContext } from './GradingStrategy.interface.js';

export class LatePenaltyGradingStrategy implements IGradingStrategy {
  readonly name = 'LATE_PENALTY';
  private readonly penaltyRatio = 0.2; // 20% penalty for late submission

  calculateFinalScore(context: SubmissionContext): number {
    if (context.rawScore < 0) {
      throw new Error('Raw score cannot be negative');
    }

    const baseScore = Math.min(context.rawScore, context.maxScore);

    // If submitted after due date, apply penalty
    if (context.submittedAt > context.dueDate) {
      const penalty = baseScore * this.penaltyRatio;
      return Math.round((baseScore - penalty) * 100) / 100;
    }

    return baseScore;
  }
}
