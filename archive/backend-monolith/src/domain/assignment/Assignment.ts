export class Assignment {
  private constructor(
    private readonly id: string,
    private readonly courseId: string,
    private title: string,
    private maxScore: number,
    private dueDate: Date,
  ) {}

  public static create(id: string, courseId: string, title: string, maxScore: number, dueDate: Date): Assignment {
    if (!title || title.trim() === '') {
      throw new Error('Assignment title cannot be empty');
    }
    if (maxScore <= 0) {
      throw new Error('Max score must be greater than zero');
    }
    if (dueDate <= new Date()) {
      throw new Error('Due date must be in the future');
    }
    return new Assignment(id, courseId, title, maxScore, dueDate);
  }

  public static restore(id: string, courseId: string, title: string, maxScore: number, dueDate: Date): Assignment {
    return new Assignment(id, courseId, title, maxScore, dueDate);
  }

  public updateDueDate(newDate: Date): void {
    if (newDate <= new Date()) {
      throw new Error('New due date must be in the future');
    }
    this.dueDate = newDate;
  }

  public getId(): string { return this.id; }
  public getCourseId(): string { return this.courseId; }
  public getTitle(): string { return this.title; }
  public getMaxScore(): number { return this.maxScore; }
  public getDueDate(): Date { return this.dueDate; }
}
