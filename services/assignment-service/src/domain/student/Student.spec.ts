import { describe, it, expect } from 'vitest';
import { Student } from './Student.js';

describe('Student Domain Entity', () => {
  it('should successfully create a student with valid name and email', () => {
    const student = Student.create('s1', 'John Doe', 'john@example.com');

    expect(student.getId()).toBe('s1');
    expect(student.getName()).toBe('John Doe');
    expect(student.getEmail()).toBe('john@example.com');
    expect(student.getEnrolledCourseIds()).toEqual([]);
  });

  it('should throw an error for empty name', () => {
    expect(() => Student.create('s2', '', 'john@example.com')).toThrow('Student name cannot be empty');
  });

  it('should throw an error for invalid email', () => {
    expect(() => Student.create('s3', 'John Doe', 'invalid-email')).toThrow('Invalid email format');
  });

  it('should enroll student into a course', () => {
    const student = Student.create('s4', 'John Doe', 'john@example.com');
    student.enrollInCourse('c100');

    expect(student.getEnrolledCourseIds()).toContain('c100');
  });

  it('should throw an error if already enrolled in the course', () => {
    const student = Student.create('s5', 'John Doe', 'john@example.com');
    student.enrollInCourse('c100');

    expect(() => student.enrollInCourse('c100')).toThrow('Student is already enrolled in this course');
  });
});
