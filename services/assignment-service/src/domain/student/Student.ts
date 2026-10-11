export class Student {
  private enrolledCourseIds: string[] = [];

  private constructor(
    private readonly id: string,
    private name: string,
    private email: string,
  ) {}

  public static create(id: string, name: string, email: string): Student {
    if (!name || name.trim() === '') {
      throw new Error('Student name cannot be empty');
    }
    if (!email.includes('@')) {
      throw new Error('Invalid email format');
    }
    return new Student(id, name, email);
  }

  public static restore(id: string, name: string, email: string, enrolledCourseIds: string[]): Student {
    const student = new Student(id, name, email);
    student.enrolledCourseIds = enrolledCourseIds;
    return student;
  }

  public enrollInCourse(courseId: string): void {
    if (this.enrolledCourseIds.includes(courseId)) {
      throw new Error('Student is already enrolled in this course');
    }
    this.enrolledCourseIds.push(courseId);
  }

  public getId(): string { return this.id; }
  public getName(): string { return this.name; }
  public getEmail(): string { return this.email; }
  public getEnrolledCourseIds(): string[] { return [...this.enrolledCourseIds]; }
}
