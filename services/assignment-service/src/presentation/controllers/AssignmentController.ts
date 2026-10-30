import { Controller, Post, Get, Param, Body, HttpCode, HttpStatus, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import { CreateAssignmentUseCase, GetAssignmentUseCase, ListAssignmentsUseCase } from '../../application/assignment/CreateAssignmentUseCase.js';
import { CreateAssignmentDto, AssignmentResponseDto } from '../dtos/CreateAssignmentDto.js';
import { Roles, UserRole } from '../../auth/auth.guard.js';

@ApiTags('Assignments')
@Controller('assignments')
export class AssignmentController {
  constructor(
    private readonly createAssignmentUseCase: CreateAssignmentUseCase,
    private readonly getAssignmentUseCase: GetAssignmentUseCase,
    private readonly listAssignmentsUseCase: ListAssignmentsUseCase,
  ) {}

  @Post()
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create an assignment',
    description: 'Synchronously contacts Course Service with a 2-second timeout. Uses fallback if Course Service is unreachable.',
  })
  @ApiBody({ type: CreateAssignmentDto })
  @ApiResponse({ status: 201, description: 'Assignment created successfully (or degraded via fallback)', type: AssignmentResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error in assignment payload' })
  async createAssignment(@Body() dto: CreateAssignmentDto) {
    return this.createAssignmentUseCase.execute(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all assignments', description: 'Returns all assignments across courses' })
  @ApiResponse({ status: 200, description: 'List of assignments', type: [AssignmentResponseDto] })
  async listAssignments() {
    return this.listAssignmentsUseCase.execute();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get assignment by ID' })
  @ApiParam({ name: 'id', description: 'Assignment UUID' })
  @ApiResponse({ status: 200, description: 'Assignment found', type: AssignmentResponseDto })
  @ApiResponse({ status: 404, description: 'Assignment not found' })
  async getAssignment(@Param('id') id: string) {
    const assignment = await this.getAssignmentUseCase.execute(id);
    if (!assignment) {
      throw new NotFoundException(`Assignment with ID ${id} not found`);
    }
    return assignment;
  }
}
