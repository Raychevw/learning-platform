import { Controller, Post, Body, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { UsersAndGroupsService } from './users-and-groups.service.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { UserRole } from '../../infrastructure/database/entities/UserEntity.js';

@ApiTags('Academic Groups & Users')
@Controller('academic-groups')
@UseGuards(RolesGuard)
export class UsersAndGroupsController {
  constructor(private readonly service: UsersAndGroupsService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Створити академічну групу (Деканат/Адмін)' })
  async createGroup(
    @Body('name') name: string,
    @Body('faculty') faculty: string,
    @Body('study_year') studyYear: number,
  ) {
    return this.service.createGroup(name, faculty, studyYear);
  }

  @Get()
  @ApiOperation({ summary: 'Список академічних груп' })
  async getGroups() {
    return this.service.getAllGroups();
  }

  @Post(':groupId/students/:studentId')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Прикріпити студента до академічної групи' })
  async assignStudent(
    @Param('groupId') groupId: string,
    @Param('studentId') studentId: string,
  ) {
    return this.service.assignStudentToGroup(studentId, groupId);
  }

  @Post(':groupId/courses/:courseId')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Призначити дисципліну на академічну групу' })
  async assignCourse(
    @Param('groupId') groupId: string,
    @Param('courseId') courseId: string,
  ) {
    return this.service.assignCourseToGroup(courseId, groupId);
  }

  @Get(':groupId/students')
  @ApiOperation({ summary: 'Список студентів конкретної академічної групи' })
  async getGroupStudents(@Param('groupId') groupId: string) {
    return this.service.getStudentsByGroup(groupId);
  }
}
