import { Assignment } from './Assignment.js';

export class AssignmentBuilder {
  private id: string = crypto.randomUUID();
  private courseId: string = '';
  private courseTitle: string = 'Untitled Course';
  private title: string = '';
  private maxScore: number = 100;
  private dueDate: Date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days in future by default
  private isCourseVerified: boolean = true;

  public withId(id: string): this {
    this.id = id;
    return this;
  }

  public forCourse(courseId: string, courseTitle?: string): this {
    this.courseId = courseId;
    if (courseTitle) {
      this.courseTitle = courseTitle;
    }
    return this;
  }

  public withTitle(title: string): this {
    this.title = title;
    return this;
  }

  public withMaxScore(maxScore: number): this {
    this.maxScore = maxScore;
    return this;
  }

  public withDueDate(dueDate: Date): this {
    this.dueDate = dueDate;
    return this;
  }

  public setVerification(isCourseVerified: boolean): this {
    this.isCourseVerified = isCourseVerified;
    return this;
  }

  public build(): Assignment {
    return Assignment.create(
      this.id,
      this.courseId,
      this.courseTitle,
      this.title,
      this.maxScore,
      this.dueDate,
      this.isCourseVerified,
    );
  }
}
