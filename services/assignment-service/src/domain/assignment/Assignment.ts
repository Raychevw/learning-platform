export class Assignment {
  private constructor(
    private readonly id: string,
    private readonly courseId: string,
    private courseTitle: string,
    private title: string,
    private maxScore: number,
    private dueDate: Date,
    private isCourseVerified: boolean,
  ) {}

  public static create(
    id: string,
    courseId: string,
    courseTitle: string,
    title: string,
    maxScore: number,
    dueDate: Date,
    isCourseVerified = true,
  ): Assignment {
    if (!courseId || courseId.trim() === '') {
      throw new Error('Course ID cannot be empty');
    }
    if (!title || title.trim() === '') {
      throw new Error('Assignment title cannot be empty');
    }
    if (maxScore <= 0) {
      throw new Error('Max score must be greater than zero');
    }
    if (dueDate <= new Date()) {
      throw new Error('Due date must be in the future');
    }
    return new Assignment(id, courseId, courseTitle, title, maxScore, dueDate, isCourseVerified);
  }

  public static restore(
    id: string,
    courseId: string,
    courseTitle: string,
    title: string,
    maxScore: number,
    dueDate: Date,
    isCourseVerified: boolean,
  ): Assignment {
    return new Assignment(id, courseId, courseTitle, title, maxScore, dueDate, isCourseVerified);
  }

  public updateDueDate(newDate: Date): void {
    if (newDate <= new Date()) {
      throw new Error('New due date must be in the future');
    }
    this.dueDate = newDate;
  }

  public setCourseVerified(verified: boolean, courseTitle?: string): void {
    this.isCourseVerified = verified;
    if (courseTitle) {
      this.courseTitle = courseTitle;
    }
  }

  public getId(): string { return this.id; }
  public getCourseId(): string { return this.courseId; }
  public getCourseTitle(): string { return this.courseTitle; }
  public getTitle(): string { return this.title; }
  public getMaxScore(): number { return this.maxScore; }
  public getDueDate(): Date { return this.dueDate; }
  public getIsCourseVerified(): boolean { return this.isCourseVerified; }
}
