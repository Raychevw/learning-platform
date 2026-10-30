import { Controller, Post, Body, Param, Put } from '@nestjs/common';
import { CreateCourseUseCase } from '../../application/course/CreateCourseUseCase.js';
import { PublishCourseUseCase } from '../../application/course/PublishCourseUseCase.js';
import { CreateCourseDto } from '../dtos/CreateCourseDto.js';

@Controller('courses')
export class CourseController {
  constructor(
    private readonly createCourseUseCase: CreateCourseUseCase,
    private readonly publishCourseUseCase: PublishCourseUseCase,
  ) {}

  @Post()
  async createCourse(@Body() createCourseDto: CreateCourseDto) {
    const course = await this.createCourseUseCase.execute(
      createCourseDto.title,
      createCourseDto.description,
    );
    
    // Convert Domain Entity to DTO for the response
    return {
      id: course.getId(),
      title: course.getTitle(),
      description: course.getDescription(),
      isPublished: course.getIsPublished(),
    };
  }

  @Put(':id/publish')
  async publishCourse(@Param('id') id: string) {
    await this.publishCourseUseCase.execute(id);
    return { message: 'Course published successfully' };
  }
}
