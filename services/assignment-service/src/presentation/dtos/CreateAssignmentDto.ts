import { ApiProperty } from '@nestjs/swagger';

export class CreateAssignmentDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000', description: 'Target Course UUID' })
  courseId!: string;

  @ApiProperty({ example: 'Lab 3: Service Decomposition', description: 'Title of the assignment' })
  title!: string;

  @ApiProperty({ example: 100, description: 'Maximum score possible' })
  maxScore!: number;

  @ApiProperty({ example: '2026-12-31T23:59:59Z', description: 'ISO 8601 Due Date (must be in future)' })
  dueDate!: string;
}

export class AssignmentResponseDto {
  @ApiProperty({ example: '234e5678-e89b-12d3-a456-426614174001' })
  id!: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  courseId!: string;

  @ApiProperty({ example: 'Clean Architecture & Microservices', description: 'Cached course title' })
  courseTitle!: string;

  @ApiProperty({ example: 'Lab 3: Service Decomposition' })
  title!: string;

  @ApiProperty({ example: 100 })
  maxScore!: number;

  @ApiProperty({ example: '2026-12-31T23:59:59.000Z' })
  dueDate!: string;

  @ApiProperty({ example: true, description: 'True if verified synchronously via Course Service, False if fallback used' })
  isCourseVerified!: boolean;

  @ApiProperty({ required: false, example: null, description: 'Warning message if graceful degradation occurred' })
  fallbackNotice?: string | null;
}

export class RegisterStudentDto {
  @ApiProperty({ example: 'Olexandr Petrenko', description: 'Full student name' })
  name!: string;

  @ApiProperty({ example: 'olexandr.petrenko@univ.edu', description: 'Student email address' })
  email!: string;
}

export class StudentResponseDto {
  @ApiProperty({ example: '345e6789-e89b-12d3-a456-426614174002' })
  id!: string;

  @ApiProperty({ example: 'Olexandr Petrenko' })
  name!: string;

  @ApiProperty({ example: 'olexandr.petrenko@univ.edu' })
  email!: string;

  @ApiProperty({ example: [] })
  enrolledCourses!: string[];
}
