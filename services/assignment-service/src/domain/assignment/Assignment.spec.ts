import { describe, it, expect } from 'vitest';
import { Assignment } from './Assignment.js';

describe('Assignment Domain Entity', () => {
  const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

  it('should successfully create an assignment with valid data', () => {
    const assignment = Assignment.create('a1', 'c1', 'Microservices 101', 'Lab 3 Homework', 100, futureDate);

    expect(assignment.getId()).toBe('a1');
    expect(assignment.getCourseId()).toBe('c1');
    expect(assignment.getCourseTitle()).toBe('Microservices 101');
    expect(assignment.getTitle()).toBe('Lab 3 Homework');
    expect(assignment.getMaxScore()).toBe(100);
    expect(assignment.getDueDate()).toBe(futureDate);
    expect(assignment.getIsCourseVerified()).toBe(true);
  });

  it('should throw an error for empty title', () => {
    expect(() => Assignment.create('a2', 'c1', 'Course', '', 100, futureDate)).toThrow('Assignment title cannot be empty');
  });

  it('should throw an error for non-positive max score', () => {
    expect(() => Assignment.create('a3', 'c1', 'Course', 'Lab 1', 0, futureDate)).toThrow('Max score must be greater than zero');
    expect(() => Assignment.create('a4', 'c1', 'Course', 'Lab 1', -10, futureDate)).toThrow('Max score must be greater than zero');
  });

  it('should throw an error for past due date', () => {
    const pastDate = new Date(Date.now() - 10000);
    expect(() => Assignment.create('a5', 'c1', 'Course', 'Lab 1', 100, pastDate)).toThrow('Due date must be in the future');
  });
});
