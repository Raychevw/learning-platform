import { IGradingStrategy, SubmissionContext } from './GradingStrategy.interface.js';

export class StandardGradingStrategy implements IGradingStrategy {
  readonly name = 'STANDARD';

  calculateFinalScore(context: SubmissionContext): number {
    if (context.rawScore < 0) {
      throw new Error('Raw score cannot be negative');
    }
    return Math.min(context.rawScore, context.maxScore);
  }
}
