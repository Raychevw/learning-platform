import { BadRequestException } from '@nestjs/common';
import type { RubricCriterion } from '../infrastructure/database/entities/AssignmentEntity.js';

export type GradingRule = 'STANDARD' | 'LATE_PENALTY' | 'EXCELLENCE_BONUS';

/**
 * Проверяет баллы по рубрике и возвращает сумму.
 * Любое расхождение с рубрикой — 400, а не «тихо приняли 999 баллов».
 */
export function validateCriteriaScores(
  scores: Record<string, number>,
  criteria: RubricCriterion[],
  maxScore: number,
): number {
  const known = new Set(criteria.map((c) => c.id));
  for (const key of Object.keys(scores ?? {})) {
    if (!known.has(key)) throw new BadRequestException(`Невідомий критерій оцінювання: ${key}`);
  }

  let sum = 0;
  for (const criterion of criteria) {
    const value = Number(scores?.[criterion.id] ?? 0);
    if (!Number.isFinite(value) || value < 0) {
      throw new BadRequestException(`Некоректний бал за критерієм "${criterion.name}"`);
    }
    if (value > criterion.max) {
      throw new BadRequestException(
        `Бал за критерієм "${criterion.name}" перевищує максимум ${criterion.max} (отримано ${value})`,
      );
    }
    sum += value;
  }

  if (sum > maxScore) {
    throw new BadRequestException(`Сума балів ${sum} перевищує максимум роботи ${maxScore}`);
  }
  return Math.round(sum * 100) / 100;
}

/** Явно выбранное правило побеждает; иначе просрочка автоматически даёт штраф. */
export function resolveRule(requested: GradingRule | undefined, isLate: boolean): GradingRule {
  return requested ?? (isLate ? 'LATE_PENALTY' : 'STANDARD');
}

export function describeRule(rule: GradingRule | string, isLate: boolean, maxScore: number, finalScore: number): string {
  if (rule === 'LATE_PENALTY') {
    return isLate ? 'Зниження на 20% (пізня здача)' : 'Зниження на 20% (за рішенням викладача)';
  }
  if (rule === 'EXCELLENCE_BONUS') {
    return `Заохочувальний бонус (+5 балів, якщо ≥ 90% від ${maxScore})`;
  }
  return isLate
    ? `Стандартний розрахунок (штраф за просрочку скасовано, ${finalScore}/${maxScore})`
    : 'Стандартний розрахунок';
}
