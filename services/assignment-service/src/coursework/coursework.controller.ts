import { Controller, Get, Post, Delete, Param, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CourseworkService } from './coursework.service.js';

@ApiTags('Coursework (Assignments, Submissions, Grading, Groups)')
@Controller()
export class CourseworkController {
  constructor(private readonly coursework: CourseworkService) {}

  // ---------------- Assignments
  @Get('assignments-full')
  @ApiOperation({ summary: 'List assignments with nested student submissions' })
  listAssignments() {
    return this.coursework.listAssignments();
  }

  @Post('assignments-full')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an assignment with rubric criteria' })
  createAssignment(@Body() dto: any) {
    return this.coursework.createAssignment(dto);
  }

  // ---------------- Submissions
  @Post('assignments/:id/submit')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit an assignment work by a student' })
  submit(@Param('id') id: string, @Body() dto: any) {
    return this.coursework.submitAssignment(id, dto);
  }

  // ---------------- Grading
  @Post('grading/grade')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Grade a submission using Strategy pattern' })
  grade(@Body() dto: any) {
    return this.coursework.gradeSubmission(dto);
  }

  @Get('grades')
  @ApiOperation({ summary: 'List all gradebook entries' })
  listGrades() {
    return this.coursework.listGrades();
  }

  // ---------------- Academic Groups
  @Get('groups')
  @ApiOperation({ summary: 'List academic groups' })
  listGroups() {
    return this.coursework.listGroups();
  }

  @Post('groups')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create academic group' })
  createGroup(@Body() dto: any) {
    return this.coursework.createGroup(dto);
  }

  @Post('groups/:id/toggle-course')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Toggle assigned course for group' })
  toggleCourse(@Param('id') id: string, @Body() dto: { courseId: string }) {
    return this.coursework.toggleCourseForGroup(id, dto.courseId);
  }

  @Post('groups/:id/students')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add student to group' })
  addStudent(@Param('id') id: string, @Body() dto: { studentName: string }) {
    return this.coursework.addStudentToGroup(id, dto.studentName);
  }

  @Delete('groups/:id/students/:name')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove student from group' })
  removeStudent(@Param('id') id: string, @Param('name') name: string) {
    return this.coursework.removeStudentFromGroup(id, decodeURIComponent(name));
  }
}
