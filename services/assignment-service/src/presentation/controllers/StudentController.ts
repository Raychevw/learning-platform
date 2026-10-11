import { Controller, Post, Get, Param, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import { RegisterStudentUseCase, GetStudentUseCase } from '../../application/student/RegisterStudentUseCase.js';
import { RegisterStudentDto, StudentResponseDto } from '../dtos/CreateAssignmentDto.js';

@ApiTags('Students')
@Controller('students')
export class StudentController {
  constructor(
    private readonly registerStudentUseCase: RegisterStudentUseCase,
    private readonly getStudentUseCase: GetStudentUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register student', description: 'Registers a new student profile in Student Bounded Context' })
  @ApiBody({ type: RegisterStudentDto })
  @ApiResponse({ status: 201, description: 'Student registered successfully', type: StudentResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid name or email' })
  async register(@Body() dto: RegisterStudentDto) {
    return this.registerStudentUseCase.execute(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get student by ID' })
  @ApiParam({ name: 'id', description: 'Student UUID' })
  @ApiResponse({ status: 200, description: 'Student profile found', type: StudentResponseDto })
  @ApiResponse({ status: 404, description: 'Student not found' })
  async getStudent(@Param('id') id: string) {
    return this.getStudentUseCase.execute(id);
  }
}
