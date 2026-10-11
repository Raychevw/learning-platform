import { Injectable, Inject, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { COURSE_REPOSITORY_TOKEN } from '../../domain/course/CourseRepository.interface.js';
import type { ICourseRepository } from '../../domain/course/CourseRepository.interface.js';
import { EVENT_PUBLISHER_TOKEN } from './EventPublisher.interface.js';
import type { IEventPublisher } from './EventPublisher.interface.js';

@Injectable()
export class PublishCourseUseCase {
  private readonly logger = new Logger(PublishCourseUseCase.name);

  constructor(
    @Inject(COURSE_REPOSITORY_TOKEN)
    private readonly courseRepository: ICourseRepository,
    @Inject(EVENT_PUBLISHER_TOKEN)
    private readonly eventPublisher: IEventPublisher,
  ) {}

  async execute(courseId: string): Promise<{ id: string; title: string; isPublished: boolean; message: string }> {
    const course = await this.courseRepository.findById(courseId);

    if (!course) {
      throw new NotFoundException(`Course with ID ${courseId} not found`);
    }

    // Idempotency check: if already published, return current state without error
    if (course.getIsPublished()) {
      return {
        id: course.getId(),
        title: course.getTitle(),
        isPublished: true,
        message: 'Course is already published',
      };
    }

    try {
      course.publish();
      await this.courseRepository.save(course);

      // Async event publication (fire-and-forget: producer doesn't depend on consumer result)
      const eventPayload = {
        eventId: crypto.randomUUID(),
        eventType: 'course.published',
        version: '1.0',
        timestamp: new Date().toISOString(),
        data: {
          courseId: course.getId(),
          title: course.getTitle(),
          description: course.getDescription(),
          publishedAt: new Date().toISOString(),
        },
      };

      this.eventPublisher.publish('course.published', eventPayload).catch((err) => {
        this.logger.warn(`Failed to publish course.published event to message broker: ${err.message}`);
      });

      return {
        id: course.getId(),
        title: course.getTitle(),
        isPublished: true,
        message: 'Course published successfully and event emitted',
      };
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
  }
}
