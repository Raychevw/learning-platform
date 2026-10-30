import { Controller, Get, Post, Delete, Param, Body, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CourseworkService } from './coursework.service.js';
import { Roles, UserRole, AuthUser } from '../auth/auth.guard.js';

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
  createAssignment(@Body() dto: any) {
    return this.coursework.createAssignment(dto);
  }

  // ---------------- Submissions
  @Post('assignments/:id/submit')
  @Roles(UserRole.STUDENT)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit an assignment work by a student' })
  submit(@Param('id') id: string, @Body() dto: any, @Req() req: AuthRequest) {
    return this.coursework.submitAssignment(id, {
      ...dto,
      // Identity always comes from the verified token, never from the request body.
      studentId: req.user.userId,
      studentName: req.user.name || dto?.studentName,
    });
  }

  // ---------------- Grading
  @Post('grading/grade')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Grade a submission using Strategy pattern' })
  grade(@Body() dto: any) {
    return this.coursework.gradeSubmission(dto);
  }

  @Get('grades')
  @ApiOperation({ summary: 'List gradebook entries (students see only their own)' })
  listGrades(@Req() req: AuthRequest) {
    return this.coursework.listGrades(req.user);
  }

  // ---------------- Academic Groups
  @Get('groups')
  @ApiOperation({ summary: 'List academic groups' })
  listGroups() {
    return this.coursework.listGroups();
  }

  @Post('groups')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create academic group' })
  createGroup(@Body() dto: any) {
    return this.coursework.createGroup(dto);
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
  @ApiOperation({ summary: 'Add student to group' })
  addStudent(@Param('id') id: string, @Body() dto: { studentName: string }) {
    return this.coursework.addStudentToGroup(id, dto.studentName);
  }

  @Delete('groups/:id/students/:name')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove student from group' })
  removeStudent(@Param('id') id: string, @Param('name') name: string) {
    return this.coursework.removeStudentFromGroup(id, decodeURIComponent(name));
  }
}
