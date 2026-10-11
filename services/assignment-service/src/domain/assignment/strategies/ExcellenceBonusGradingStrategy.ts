import { IGradingStrategy, SubmissionContext } from './GradingStrategy.interface.js';

export class ExcellenceBonusGradingStrategy implements IGradingStrategy {
  readonly name = 'EXCELLENCE_BONUS';

  calculateFinalScore(context: SubmissionContext): number {
    if (context.rawScore < 0) {
      throw new Error('Raw score cannot be negative');
    }

    const baseScore = Math.min(context.rawScore, context.maxScore);
    const scoreRatio = baseScore / context.maxScore;

    // Bonus 5% if score >= 90% and submitted on or before due date
    if (scoreRatio >= 0.9 && context.submittedAt <= context.dueDate) {
      const bonus = context.maxScore * 0.05;
      return Math.min(context.maxScore, Math.round((baseScore + bonus) * 100) / 100);
    }

    return baseScore;
  }
}
