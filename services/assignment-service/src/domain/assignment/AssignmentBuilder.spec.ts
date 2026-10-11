import { describe, it, expect } from 'vitest';
import { AssignmentBuilder } from './AssignmentBuilder.js';

describe('AssignmentBuilder (Builder Pattern)', () => {
  const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 5);

  it('should build an assignment using fluent builder methods', () => {
    const assignment = new AssignmentBuilder()
      .withId('b-101')
      .forCourse('c-200', 'Distributed Architecture')
      .withTitle('System Design Homework')
      .withMaxScore(50)
      .withDueDate(futureDate)
      .setVerification(true)
      .build();

    expect(assignment.getId()).toBe('b-101');
    expect(assignment.getCourseId()).toBe('c-200');
    expect(assignment.getCourseTitle()).toBe('Distributed Architecture');
    expect(assignment.getTitle()).toBe('System Design Homework');
    expect(assignment.getMaxScore()).toBe(50);
    expect(assignment.getDueDate()).toBe(futureDate);
    expect(assignment.getIsCourseVerified()).toBe(true);
  });

  it('should enforce domain validation when building invalid assignment', () => {
    const builder = new AssignmentBuilder()
      .forCourse('c-200')
      .withTitle('') // empty title
      .withDueDate(futureDate);

    expect(() => builder.build()).toThrow('Assignment title cannot be empty');
  });
});
