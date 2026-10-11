import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { Assignment } from '../../domain/assignment/Assignment.js';
import { ASSIGNMENT_REPOSITORY_TOKEN } from '../../domain/assignment/AssignmentRepository.interface.js';
import type { IAssignmentRepository } from '../../domain/assignment/AssignmentRepository.interface.js';

@Injectable()
export class RedisEventConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisEventConsumer.name);
  private subscriber: Redis | null = null;

  constructor(
    private readonly configService: ConfigService,
    @Inject(ASSIGNMENT_REPOSITORY_TOKEN)
    private readonly assignmentRepository: IAssignmentRepository,
  ) {}

  onModuleInit() {
    const host = this.configService.get<string>('REDIS_HOST', 'localhost');
    const port = this.configService.get<number>('REDIS_PORT', 6379);

    try {
      this.subscriber = new Redis({
        host,
        port,
        lazyConnect: true,
        retryStrategy: (times) => {
          if (times > 3) {
            this.logger.warn(`Redis unavailable at ${host}:${port}. Event consumer running in idle state.`);
            return null;
          }
          return 1000;
        },
      });

      this.subscriber.on('connect', () => {
        this.logger.log(`[ASYNC CONSUMER] Connected to Redis broker at ${host}:${port}`);
        this.subscribeToChannels();
      });

      this.subscriber.on('error', (err) => {
        this.logger.warn(`[ASYNC CONSUMER] Redis subscriber error: ${err.message}`);
      });

      this.subscriber.connect().catch((err) => {
        this.logger.warn(`[ASYNC CONSUMER] Could not connect to Redis: ${err.message}`);
      });
    } catch (err) {
      this.logger.warn(`[ASYNC CONSUMER] Initialization failed: ${(err as Error).message}`);
    }
  }

  private async subscribeToChannels() {
    if (!this.subscriber) return;

    await this.subscriber.subscribe('course.published');
    this.logger.log(`[ASYNC CONSUMER] Subscribed to topic: 'course.published'`);

    this.subscriber.on('message', async (channel, message) => {
      if (channel === 'course.published') {
        await this.handleCoursePublished(message);
      }
    });
  }

  public async handleCoursePublished(rawMessage: string) {
    try {
      this.logger.log(`[ASYNC EVENT RECEIVED] Event payload: ${rawMessage}`);
      const event = JSON.parse(rawMessage);
      const { courseId, title } = event.data || {};

      if (!courseId) {
        this.logger.warn('Event missing courseId, skipping.');
        return;
      }

      // Check if welcome assignment already exists (idempotency check)
      const existing = await this.assignmentRepository.findByCourseId(courseId);
      const alreadyHasWelcome = existing.some((a) => a.getTitle().includes('Welcome'));

      if (alreadyHasWelcome) {
        this.logger.log(`Welcome assignment already created for course ${courseId}. Skipping duplicate.`);
        return;
      }

      // Auto-generate onboarding assignment in response to course publication
      const assignmentId = crypto.randomUUID();
      const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days later
      const welcomeAssignment = Assignment.create(
        assignmentId,
        courseId,
        title || 'Published Course',
        `Welcome & Onboarding Quiz: ${title || 'Course'}`,
        100,
        dueDate,
        true,
      );

      await this.assignmentRepository.save(welcomeAssignment);
      this.logger.log(
        `[ASYNC EVENT HANDLED] Automatically generated onboarding assignment ${assignmentId} for published course "${title}"`,
      );
    } catch (error) {
      this.logger.error(`Error processing course.published event: ${(error as Error).message}`);
    }
  }

  async onModuleDestroy() {
    if (this.subscriber) {
      try {
        await this.subscriber.quit();
      } catch {
        // ignore
      }
    }
  }
}
