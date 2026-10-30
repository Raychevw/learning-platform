import { describe, it, expect } from 'vitest';
import { Student } from './Student.js';

describe('Student Domain Entity', () => {
  it('should create a valid student', () => {
    const student = Student.create('1', 'John Doe', 'john@example.com');
    expect(student.getName()).toBe('John Doe');
  });

  it('should throw an error for invalid email', () => {
    expect(() => {
      Student.create('1', 'John', 'invalid-email');
    }).toThrow('Invalid email format');
  });

  it('should enroll in a course', () => {
    const student = Student.create('1', 'John', 'john@example.com');
    student.enrollInCourse('course-1');
    expect(student.getEnrolledCourseIds()).toContain('course-1');
  });

  it('should not allow duplicate enrollment', () => {
    const student = Student.create('1', 'John', 'john@example.com');
    student.enrollInCourse('course-1');
    expect(() => {
      student.enrollInCourse('course-1');
    }).toThrow('Student is already enrolled in this course');
  });
});
