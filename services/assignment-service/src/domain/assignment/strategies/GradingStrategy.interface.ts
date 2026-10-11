export interface SubmissionContext {
  rawScore: number;
  maxScore: number;
  submittedAt: Date;
  dueDate: Date;
}

export interface IGradingStrategy {
  readonly name: string;
  calculateFinalScore(context: SubmissionContext): number;
}
