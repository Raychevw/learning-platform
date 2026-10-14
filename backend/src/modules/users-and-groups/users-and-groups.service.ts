import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { AcademicGroupEntity } from '../../infrastructure/database/entities/AcademicGroupEntity.js';
import { StudentGroupEntity } from '../../infrastructure/database/entities/StudentGroupEntity.js';
import { CourseGroupEntity } from '../../infrastructure/database/entities/CourseGroupEntity.js';
import { UserEntity, UserRole } from '../../infrastructure/database/entities/UserEntity.js';

@Injectable()
export class UsersAndGroupsService {
  constructor(
    @InjectRepository(AcademicGroupEntity)
    private readonly groupRepo: Repository<AcademicGroupEntity>,
    @InjectRepository(StudentGroupEntity)
    private readonly studentGroupRepo: Repository<StudentGroupEntity>,
    @InjectRepository(CourseGroupEntity)
    private readonly courseGroupRepo: Repository<CourseGroupEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  async createGroup(name: string, faculty: string, studyYear: number = 1): Promise<AcademicGroupEntity> {
    const group = this.groupRepo.create({ name, faculty, study_year: studyYear });
    return this.groupRepo.save(group);
  }

  async getAllGroups(): Promise<AcademicGroupEntity[]> {
    return this.groupRepo.find();
  }

  async assignStudentToGroup(studentId: string, groupId: string): Promise<StudentGroupEntity> {
    const student = await this.userRepo.findOne({ where: { id: studentId, role: UserRole.STUDENT } });
    if (!student) {
      throw new NotFoundException(`Студента з ID ${studentId} не знайдено`);
    }

    const group = await this.groupRepo.findOne({ where: { id: groupId } });
    if (!group) {
      throw new NotFoundException(`Академічну групу з ID ${groupId} не знайдено`);
    }

    const assignment = this.studentGroupRepo.create({
      student_id: studentId,
      group_id: groupId,
    });
    return this.studentGroupRepo.save(assignment);
  }

  async assignCourseToGroup(courseId: string, groupId: string): Promise<CourseGroupEntity> {
    const group = await this.groupRepo.findOne({ where: { id: groupId } });
    if (!group) {
      throw new NotFoundException(`Академічну групу з ID ${groupId} не знайдено`);
    }

    const assignment = this.courseGroupRepo.create({
      course_id: courseId,
      group_id: groupId,
    });
    return this.courseGroupRepo.save(assignment);
  }

  async getStudentsByGroup(groupId: string): Promise<UserEntity[]> {
    const mappings = await this.studentGroupRepo.find({ where: { group_id: groupId } });
    const studentIds = mappings.map((m) => m.student_id);
    if (studentIds.length === 0) return [];
    return this.userRepo.findBy({ id: In(studentIds) });
  }
}
