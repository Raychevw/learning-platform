import { describe, it, expect } from 'vitest';
import { Course } from './Course.js';

describe('Course Domain Entity', () => {
  it('should successfully create a draft course with valid data', () => {
    const course = Course.create('c1', 'Domain-Driven Design', 'Learn DDD principles');

    expect(course.getId()).toBe('c1');
    expect(course.getTitle()).toBe('Domain-Driven Design');
    expect(course.getDescription()).toBe('Learn DDD principles');
    expect(course.getIsPublished()).toBe(false);
  });

  it('should throw an error when creating a course with empty title', () => {
    expect(() => Course.create('c2', '', 'Description')).toThrow('Course title cannot be empty');
    expect(() => Course.create('c3', '   ', 'Description')).toThrow('Course title cannot be empty');
  });

  it('should publish a course when description is provided', () => {
    const course = Course.create('c4', 'Architecture 101', 'Solid fundamentals');
    course.publish();

    expect(course.getIsPublished()).toBe(true);
  });

  it('should throw an error when trying to publish a course without a description', () => {
    const course = Course.create('c5', 'Draft Course', '');
    expect(() => course.publish()).toThrow('Cannot publish a course without a description');
  });

  it('should unpublish a course', () => {
    const course = Course.create('c6', 'Architecture 101', 'Solid fundamentals');
    course.publish();
    course.unpublish();

    expect(course.getIsPublished()).toBe(false);
  });
});
