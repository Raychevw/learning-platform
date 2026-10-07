import { describe, it, expect } from 'vitest';
import { Assignment } from './Assignment.js';

describe('Assignment Domain Entity', () => {
  it('should create a valid assignment', () => {
    const futureDate = new Date(Date.now() + 86400000); // tomorrow
    const assignment = Assignment.create('1', 'course-1', 'Test Assignment', 100, futureDate);
    expect(assignment.getTitle()).toBe('Test Assignment');
    expect(assignment.getMaxScore()).toBe(100);
  });

  it('should throw error for negative score', () => {
    const futureDate = new Date(Date.now() + 86400000);
    expect(() => {
      Assignment.create('1', 'course-1', 'Test', -10, futureDate);
    }).toThrow('Max score must be greater than zero');
  });

  it('should throw error for past due date', () => {
    const pastDate = new Date(Date.now() - 86400000); // yesterday
    expect(() => {
      Assignment.create('1', 'course-1', 'Test', 100, pastDate);
    }).toThrow('Due date must be in the future');
  });
});
