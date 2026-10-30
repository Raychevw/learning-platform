import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import type { Response } from 'express';
import { CourseworkService } from './coursework.service.js';
import { Roles, UserRole, AuthUser } from '../auth/auth.guard.js';
import { submissionMulterOptions } from './upload.config.js';
import {
  CreateAssignmentBodyDto,
  SubmitBodyDto,
  GradeBodyDto,
  CreateGroupBodyDto,
  EnrollStudentBodyDto,
} from './dto.js';

interface AuthRequest {
  user: AuthUser;
}

@ApiTags('Coursework (Assignments, Submissions, Grading, Groups)')
@ApiBearerAuth()
@Controller()
export class CourseworkController {
  constructor(private readonly coursework: CourseworkService) {}

  // ---------------- Assignments
  @Get('assignments-full')
  @ApiOperation({ summary: 'List assignments with nested student submissions' })
  listAssignments(@Req() req: AuthRequest) {
    return this.coursework.listAssignments(req.user);
  }

  @Post('assignments-full')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an assignment with rubric criteria' })
  createAssignment(@Body() dto: CreateAssignmentBodyDto) {
    return this.coursework.createAssignment(dto);
  }

  // ---------------- Submissions
  @Post('assignments/:id/submit')
  @Roles(UserRole.STUDENT)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit an assignment work (JSON, without a file)' })
  submit(@Param('id') id: string, @Body() dto: SubmitBodyDto, @Req() req: AuthRequest) {
    return this.coursework.submitAssignment(id, dto, req.user);
  }

  @Post('assignments/:id/submit-file')
  @Roles(UserRole.STUDENT)
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file', submissionMulterOptions))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Submit an assignment work with a real file upload' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        comment: { type: 'string' },
      },
    },
  })
  submitFile(
    @Param('id') id: string,
    @Body() dto: SubmitBodyDto,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthRequest,
  ) {
    if (!file) throw new BadRequestException('Оберіть файл для завантаження');
    return this.coursework.submitAssignmentWithFile(id, dto, req.user, file);
  }

  @Get('submissions/:id/file')
  @ApiOperation({ summary: 'Download a submitted file (owner, teacher or admin only)' })
  async download(
    @Param('id') id: string,
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { stream, fileName, mimeType } = await this.coursework.getSubmissionFile(id, req.user);
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      'Cache-Control': 'private, no-store',
    });
    return new StreamableFile(stream);
  }

  // ---------------- Grading
  @Post('grading/grade')
  @Roles(UserRole.TEACHER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Grade a submission using server-side rubric validation and Strategy pattern (teacher only)' })
  grade(@Body() dto: GradeBodyDto, @Req() req: AuthRequest) {
    return this.coursework.gradeSubmission(dto, req.user);
  }

  @Get('grades')
  @ApiOperation({ summary: 'List gradebook entries (students see only their own)' })
  listGrades(@Req() req: AuthRequest) {
    return this.coursework.listGrades(req.user);
  }

  // ---------------- Academic Groups
  @Get('groups')
  @ApiOperation({ summary: 'List academic groups with enrolled user ids' })
  listGroups() {
    return this.coursework.listGroups();
  }

  @Post('groups')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create academic group' })
  createGroup(@Body() dto: CreateGroupBodyDto) {
    return this.coursework.createGroup(dto);
  }

  @Patch('groups/:id/curator')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Assign a curator (teacher) to a group' })
  assignCurator(@Param('id') id: string, @Body() dto: { curatorId?: string | null }) {
    return this.coursework.assignCurator(id, dto?.curatorId ?? null);
  }

  @Post('groups/:id/toggle-course')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Toggle assigned course for group' })
  toggleCourse(@Param('id') id: string, @Body() dto: { courseId: string }) {
    return this.coursework.toggleCourseForGroup(id, dto.courseId);
  }

  @Post('groups/:id/students')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add student name to the group roster' })
  addStudent(@Param('id') id: string, @Body() dto: { studentName: string }) {
    return this.coursework.addStudentToGroup(id, dto.studentName);
  }

  @Delete('groups/:id/students/:name')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove student name from the group roster' })
  removeStudent(@Param('id') id: string, @Param('name') name: string) {
    return this.coursework.removeStudentFromGroup(id, decodeURIComponent(name));
  }

  // ---------------- Analytics (dean / administration)
  @Get('analytics/overview')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Faculty-wide performance analytics: debts, missing works, ungraded, groups' })
  analytics() {
    return this.coursework.analyticsOverview();
  }

  // ---------------- Enrollments (user <-> group)
  @Get('enrollments')
  @ApiOperation({ summary: 'List enrollments (course roster for any authenticated user; full list for staff)' })
  listEnrollments(@Query('courseId') courseId: string, @Req() req: AuthRequest) {
    if (courseId) return this.coursework.listEnrollmentsForCourse(courseId);
    if (req.user.role === UserRole.STUDENT) {
      throw new ForbiddenException('Повний список зачислень доступний лише викладачам та адміністраторам');
    }
    return this.coursework.listEnrollments();
  }

  @Post('groups/:id/enroll')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Enroll a user into an academic group' })
  enroll(@Param('id') id: string, @Body() dto: EnrollStudentBodyDto) {
    return this.coursework.enrollStudent(id, dto);
  }

  @Delete('groups/:id/enroll/:userId')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a user from an academic group' })
  unenroll(@Param('id') id: string, @Param('userId') userId: string) {
    return this.coursework.unenrollStudent(id, userId);
  }
}
