import { describe, it, expect } from 'vitest';
import { StandardGradingStrategy } from './StandardGradingStrategy.js';
import { LatePenaltyGradingStrategy } from './LatePenaltyGradingStrategy.js';
import { ExcellenceBonusGradingStrategy } from './ExcellenceBonusGradingStrategy.js';

describe('GradingStrategy (Strategy Pattern)', () => {
  const dueDate = new Date('2026-11-01T23:59:59Z');
  const onTimeDate = new Date('2026-11-01T12:00:00Z');
  const lateDate = new Date('2026-11-02T12:00:00Z');

  describe('StandardGradingStrategy', () => {
    const strategy = new StandardGradingStrategy();

    it('should return exact raw score when within max score', () => {
      const score = strategy.calculateFinalScore({
        rawScore: 85,
        maxScore: 100,
        submittedAt: onTimeDate,
        dueDate,
      });
      expect(score).toBe(85);
    });

    it('should cap score at maxScore', () => {
      const score = strategy.calculateFinalScore({
        rawScore: 120,
        maxScore: 100,
        submittedAt: onTimeDate,
        dueDate,
      });
      expect(score).toBe(100);
    });
  });

  describe('LatePenaltyGradingStrategy', () => {
    const strategy = new LatePenaltyGradingStrategy();

    it('should not apply penalty for on-time submission', () => {
      const score = strategy.calculateFinalScore({
        rawScore: 100,
        maxScore: 100,
        submittedAt: onTimeDate,
        dueDate,
      });
      expect(score).toBe(100);
    });

    it('should apply 20% penalty for late submission', () => {
      const score = strategy.calculateFinalScore({
        rawScore: 100,
        maxScore: 100,
        submittedAt: lateDate,
        dueDate,
      });
      expect(score).toBe(80);
    });
  });

  describe('ExcellenceBonusGradingStrategy', () => {
    const strategy = new ExcellenceBonusGradingStrategy();

    it('should apply 5% bonus for high scores submitted on time', () => {
      const score = strategy.calculateFinalScore({
        rawScore: 92,
        maxScore: 100,
        submittedAt: onTimeDate,
        dueDate,
      });
      // 92 + 5 = 97
      expect(score).toBe(97);
    });

    it('should not exceed maxScore with bonus', () => {
      const score = strategy.calculateFinalScore({
        rawScore: 98,
        maxScore: 100,
        submittedAt: onTimeDate,
        dueDate,
      });
      expect(score).toBe(100);
    });
  });
});
