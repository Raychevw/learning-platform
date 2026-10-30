import { describe, it, expect } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { validateCriteriaScores, resolveRule, describeRule } from './grading-policy.js';
import type { RubricCriterion } from '../infrastructure/database/entities/AssignmentEntity.js';

const criteria: RubricCriterion[] = [
  { id: 'clean_arch', name: 'Архітектура', max: 40 },
  { id: 'patterns', name: 'Патерни', max: 35 },
  { id: 'tests', name: 'Тести', max: 25 },
];

describe('validateCriteriaScores', () => {
  it('суммирует валидные баллы', () => {
    expect(validateCriteriaScores({ clean_arch: 35, patterns: 30, tests: 20 }, criteria, 100)).toBe(85);
  });

  it('недостающие критерии считаются нулём', () => {
    expect(validateCriteriaScores({ clean_arch: 40 }, criteria, 100)).toBe(40);
  });

  it('отклоняет балл выше максимума критерия', () => {
    expect(() => validateCriteriaScores({ clean_arch: 41 }, criteria, 100)).toThrow(BadRequestException);
  });

  it('отклоняет отрицательный балл', () => {
    expect(() => validateCriteriaScores({ tests: -1 }, criteria, 100)).toThrow(BadRequestException);
  });

  it('отклоняет неизвестный критерий', () => {
    expect(() => validateCriteriaScores({ hack: 10 }, criteria, 100)).toThrow(BadRequestException);
  });

  it('отклоняет сумму больше максимума работы', () => {
    const smallerMax = 50;
    expect(() => validateCriteriaScores({ clean_arch: 40, patterns: 35 }, criteria, smallerMax)).toThrow(
      BadRequestException,
    );
  });

  it('округляет до двух знаков', () => {
    expect(validateCriteriaScores({ clean_arch: 33.333 }, criteria, 100)).toBe(33.33);
  });
});

describe('resolveRule', () => {
  it('просрочка без явного правила -> LATE_PENALTY', () => {
    expect(resolveRule(undefined, true)).toBe('LATE_PENALTY');
  });

  it('в срок без явного правила -> STANDARD', () => {
    expect(resolveRule(undefined, false)).toBe('STANDARD');
  });

  it('явное правило имеет приоритет', () => {
    expect(resolveRule('EXCELLENCE_BONUS', true)).toBe('EXCELLENCE_BONUS');
    expect(resolveRule('STANDARD', true)).toBe('STANDARD');
  });
});

describe('describeRule', () => {
  it('описывает штраф за просрочку', () => {
    expect(describeRule('LATE_PENALTY', true, 100, 80)).toContain('пізня здача');
  });

  it('помечает переопределение штрафа', () => {
    expect(describeRule('STANDARD', true, 100, 95)).toContain('скасовано');
  });
});
