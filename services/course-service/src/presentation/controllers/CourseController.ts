import { Controller, Post, Get, Param, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import { CreateCourseUseCase } from '../../application/course/CreateCourseUseCase.js';
import { PublishCourseUseCase } from '../../application/course/PublishCourseUseCase.js';
import { GetCourseUseCase, ListCoursesUseCase } from '../../application/course/GetCourseUseCase.js';
import { CreateCourseDto, CourseResponseDto } from '../dtos/CreateCourseDto.js';

@ApiTags('Courses')
@Controller('courses')
export class CourseController {
  constructor(
    private readonly createCourseUseCase: CreateCourseUseCase,
    private readonly publishCourseUseCase: PublishCourseUseCase,
    private readonly getCourseUseCase: GetCourseUseCase,
    private readonly listCoursesUseCase: ListCoursesUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new course', description: 'Creates a draft course in Course Bounded Context' })
  @ApiBody({ type: CreateCourseDto })
  @ApiResponse({ status: 201, description: 'Course created successfully', type: CourseResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error: Title cannot be empty' })
  async createCourse(@Body() dto: CreateCourseDto) {
    return this.createCourseUseCase.execute(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all courses', description: 'Returns all available courses in the catalog' })
  @ApiResponse({ status: 200, description: 'List of courses returned', type: [CourseResponseDto] })
  async listCourses() {
    return this.listCoursesUseCase.execute();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get course by ID', description: 'Synchronously queried by internal services and clients' })
  @ApiParam({ name: 'id', description: 'UUID of the course' })
  @ApiResponse({ status: 200, description: 'Course found', type: CourseResponseDto })
  @ApiResponse({ status: 404, description: 'Course with specified ID not found' })
  async getCourse(@Param('id') id: string) {
    return this.getCourseUseCase.execute(id);
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Publish course (Idempotent)', 
    description: 'Publishes course and emits course.published event to message broker' 
  })
  @ApiParam({ name: 'id', description: 'UUID of the course to publish' })
  @ApiResponse({ status: 200, description: 'Course published and event emitted' })
  @ApiResponse({ status: 400, description: 'Course cannot be published without description' })
  @ApiResponse({ status: 404, description: 'Course not found' })
  async publishCourse(@Param('id') id: string) {
    return this.publishCourseUseCase.execute(id);
  }
}
