import { describe, it, expect } from 'vitest';
import { Course } from './Course.js';

describe('Course Domain Entity', () => {
  it('should create a valid course', () => {
    const course = Course.create('1', 'Test Title', 'Test Description');
    expect(course.getTitle()).toBe('Test Title');
    expect(course.getIsPublished()).toBe(false);
  });

  it('should throw an error if title is empty', () => {
    expect(() => {
      Course.create('1', '', 'Desc');
    }).toThrow('Course title cannot be empty');
  });

  it('should publish a course if description is present', () => {
    const course = Course.create('1', 'Title', 'Valid description');
    course.publish();
    expect(course.getIsPublished()).toBe(true);
  });

  it('should throw an error when publishing without description', () => {
    const course = Course.create('1', 'Title', '');
    expect(() => {
      course.publish();
    }).toThrow('Cannot publish a course without a description');
  });
});
