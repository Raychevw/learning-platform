import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GradeEntity } from '../../infrastructure/database/entities/GradeEntity.js';
import { SubmissionEntity, SubmissionStatus } from '../../infrastructure/database/entities/SubmissionEntity.js';

export type GradingRule = 'STANDARD' | 'LATE_PENALTY' | 'EXCELLENCE_BONUS';

@Injectable()
export class GradingService {
  constructor(
    @InjectRepository(GradeEntity)
    private readonly gradeRepo: Repository<GradeEntity>,
    @InjectRepository(SubmissionEntity)
    private readonly submissionRepo: Repository<SubmissionEntity>,
  ) {}

  /**
   * Evaluate submission using dynamic JSONB criteria and grading strategies
   */
  async gradeSubmission(
    submissionId: string,
    teacherId: string,
    rubricEvaluation: Record<string, number>,
    feedbackComment: string = '',
    rule: GradingRule = 'STANDARD',
  ): Promise<GradeEntity> {
    const submission = await this.submissionRepo.findOne({ where: { id: submissionId } });
    if (!submission) {
      throw new NotFoundException('Здану роботу не знайдено');
    }

    // Calculate base score from criteria
    let rawScore = Object.values(rubricEvaluation).reduce((sum, val) => sum + Number(val), 0);
    let finalScore = rawScore;

    // Apply Strategy Rule
    if (rule === 'LATE_PENALTY') {
      finalScore = Math.round(rawScore * 0.8 * 100) / 100;
    } else if (rule === 'EXCELLENCE_BONUS') {
      finalScore = rawScore >= 90 ? Math.min(100, rawScore + 5) : rawScore;
    }

    let grade = await this.gradeRepo.findOne({ where: { submission_id: submissionId } });
    if (!grade) {
      grade = this.gradeRepo.create({
        submission_id: submissionId,
        teacher_id: teacherId,
        total_score: finalScore,
        rubric_evaluation_json: rubricEvaluation,
        feedback_comment: feedbackComment,
      });
    } else {
      grade.teacher_id = teacherId;
      grade.total_score = finalScore;
      grade.rubric_evaluation_json = rubricEvaluation;
      grade.feedback_comment = feedbackComment;
      grade.graded_at = new Date();
    }

    const savedGrade = await this.gradeRepo.save(grade);

    // Update submission status to GRADED
    submission.status = SubmissionStatus.GRADED;
    await this.submissionRepo.save(submission);

    return savedGrade;
  }

  async getGradeBySubmission(submissionId: string): Promise<GradeEntity | null> {
    return this.gradeRepo.findOne({ where: { submission_id: submissionId } });
  }

  async getStudentGradebook(studentId: string): Promise<any[]> {
    const submissions = await this.submissionRepo.find({
      where: { student_id: studentId },
      relations: { assignment: true },
    });

    const gradebookEntries = await Promise.all(
      submissions.map(async (sub) => {
        const grade = await this.gradeRepo.findOne({ where: { submission_id: sub.id } });
        return {
          assignmentTitle: sub.assignment?.title,
          maxScore: sub.assignment?.max_score,
          submittedAt: sub.submitted_at,
          status: sub.status,
          score: grade?.total_score ?? null,
          feedback: grade?.feedback_comment ?? null,
          rubricEvaluation: grade?.rubric_evaluation_json ?? null,
          gradedAt: grade?.graded_at ?? null,
        };
      }),
    );

    return gradebookEntries;
  }
}
