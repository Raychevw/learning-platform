import { Logger } from '@nestjs/common';
import { CourseClientDto, ICourseServiceClient } from '../CourseServiceClient.js';

export class CachingCourseServiceDecorator implements ICourseServiceClient {
  private readonly logger = new Logger(CachingCourseServiceDecorator.name);
  private readonly cache: Map<string, { data: CourseClientDto; expiresAt: number }> = new Map();
  private readonly ttlMs: number;

  constructor(
    private readonly innerClient: ICourseServiceClient,
    ttlMs: number = 60000, // 1 minute default cache
  ) {
    this.ttlMs = ttlMs;
  }

  async getCourse(courseId: string): Promise<CourseClientDto> {
    const cached = this.cache.get(courseId);
    const now = Date.now();

    if (cached && cached.expiresAt > now) {
      this.logger.log(`[DECORATOR: CACHE HIT] Returning cached course info for courseId="${courseId}"`);
      return cached.data;
    }

    const freshResult = await this.innerClient.getCourse(courseId);

    // Only cache successfully verified responses
    if (freshResult.isVerified) {
      this.cache.set(courseId, {
        data: freshResult,
        expiresAt: now + this.ttlMs,
      });
      this.logger.log(`[DECORATOR: CACHE STORE] Cached course info for courseId="${courseId}" (TTL: ${this.ttlMs}ms)`);
    }

    return freshResult;
  }

  clearCache(): void {
    this.cache.clear();
  }
}
