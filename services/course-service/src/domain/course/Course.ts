export class Course {
  private constructor(
    private readonly id: string,
    private title: string,
    private description: string,
    private isPublished: boolean,
  ) {}

  public static create(id: string, title: string, description: string): Course {
    if (!title || title.trim() === '') {
      throw new Error('Course title cannot be empty');
    }
    return new Course(id, title, description, false);
  }

  // Restore from DB without triggering domain rules
  public static restore(id: string, title: string, description: string, isPublished: boolean): Course {
    return new Course(id, title, description, isPublished);
  }

  public publish(): void {
    if (!this.description || this.description.trim() === '') {
      throw new Error('Cannot publish a course without a description');
    }
    this.isPublished = true;
  }

  public unpublish(): void {
    this.isPublished = false;
  }

  public updateDetails(title: string, description: string): void {
    if (!title || title.trim() === '') {
      throw new Error('Course title cannot be empty');
    }
    this.title = title;
    this.description = description;
  }

  // Getters for infrastructure / presentation mapping
  public getId(): string { return this.id; }
  public getTitle(): string { return this.title; }
  public getDescription(): string { return this.description; }
  public getIsPublished(): boolean { return this.isPublished; }
}
