import { ApiProperty } from '@nestjs/swagger';

export class CreateCourseDto {
  @ApiProperty({ example: 'Clean Architecture & Microservices', description: 'Title of the course' })
  title!: string;

  @ApiProperty({ example: 'Hands-on practical guide to decomposing monoliths into services', description: 'Course syllabus and description' })
  description!: string;
}

export class CourseResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id!: string;

  @ApiProperty({ example: 'Clean Architecture & Microservices' })
  title!: string;

  @ApiProperty({ example: 'Hands-on practical guide' })
  description!: string;

  @ApiProperty({ example: false })
  isPublished!: boolean;
}
