import { Controller, Post, Body, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { GradingService } from './grading.service.js';
import type { GradingRule } from './grading.service.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { OwnershipGuard } from '../auth/ownership.guard.js';
import { UserRole } from '../../infrastructure/database/entities/UserEntity.js';

@ApiTags('Grading & Electronic Gradebook')
@Controller('grading')
@UseGuards(RolesGuard)
export class GradingController {
  constructor(private readonly gradingService: GradingService) {}

  @Post('submissions/:submissionId')
  @Roles(UserRole.TEACHER)
  @ApiOperation({ summary: 'Виставити оцінку за рубрикою критеріїв (тільки викладач)' })
  async gradeSubmission(
    @Param('submissionId') submissionId: string,
    @Body('teacher_id') teacherId: string,
    @Body('rubric_evaluation') rubricEvaluation: Record<string, number>,
    @Body('feedback_comment') feedbackComment: string,
    @Body('rule') rule: GradingRule = 'STANDARD',
  ) {
    return this.gradingService.gradeSubmission(submissionId, teacherId, rubricEvaluation, feedbackComment, rule);
  }

  @Get('submissions/:submissionId')
  @ApiOperation({ summary: 'Отримати оцінку конкретної роботи' })
  async getGrade(@Param('submissionId') submissionId: string) {
    return this.gradingService.getGradeBySubmission(submissionId);
  }

  @Get('gradebook/student/:studentId')
  @UseGuards(OwnershipGuard)
  @ApiOperation({ summary: 'Електронний журнал успішності студента' })
  async getGradebook(@Param('studentId') studentId: string) {
    return this.gradingService.getStudentGradebook(studentId);
  }
}
