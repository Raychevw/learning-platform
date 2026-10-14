import { Controller, Post, Body, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AssignmentService } from './assignment.service.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { OwnershipGuard } from '../auth/ownership.guard.js';
import { UserRole } from '../../infrastructure/database/entities/UserEntity.js';
import { AssignmentType } from '../../infrastructure/database/entities/AssignmentEntity.js';
import { RubricCriterion } from '../../infrastructure/database/entities/RubricEntity.js';

@ApiTags('Assignments, Rubrics & Submissions')
@Controller('assignments')
@UseGuards(RolesGuard)
export class AssignmentController {
  constructor(private readonly assignmentService: AssignmentService) {}

  @Post('rubrics')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Створити рубрику оцінювання з критеріями (JSONB)' })
  async createRubric(
    @Body('title') title: string,
    @Body('criteria') criteria: RubricCriterion[],
  ) {
    return this.assignmentService.createRubric(title, criteria);
  }

  @Get('rubrics')
  @ApiOperation({ summary: 'Отримати перелік усіх рубрик оцінювання' })
  async getRubrics() {
    return this.assignmentService.getAllRubrics();
  }

  @Post()
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Створити завдання з дедлайном та рубрикою' })
  async createAssignment(
    @Body('module_id') moduleId: string,
    @Body('title') title: string,
    @Body('description') description: string,
    @Body('type') type: AssignmentType,
    @Body('max_score') maxScore: number,
    @Body('deadline') deadline: string,
    @Body('rubric_id') rubricId?: string,
  ) {
    return this.assignmentService.createAssignment(
      moduleId,
      title,
      description,
      type,
      maxScore,
      new Date(deadline),
      rubricId,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Отримати список усіх завдань' })
  async getAllAssignments() {
    return this.assignmentService.getAllAssignments();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Деталі завдання з рубрикою' })
  async getAssignment(@Param('id') id: string) {
    return this.assignmentService.getAssignmentById(id);
  }

  @Post(':id/submit')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Здати роботу на перевірку до настання дедлайну' })
  async submitWork(
    @Param('id') id: string,
    @Body('student_id') studentId: string,
    @Body('student_comment') studentComment: string,
  ) {
    return this.assignmentService.submitWork(id, studentId, studentComment);
  }

  @Get(':id/submissions')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Переглянути здані роботи студентів за завданням' })
  async getSubmissions(@Param('id') id: string) {
    return this.assignmentService.getSubmissionsByAssignment(id);
  }

  @Get('student/:studentId/submissions')
  @UseGuards(OwnershipGuard)
  @ApiOperation({ summary: 'Переглянути власні здані роботи студента' })
  async getStudentSubmissions(@Param('studentId') studentId: string) {
    return this.assignmentService.getStudentSubmissions(studentId);
  }
}
