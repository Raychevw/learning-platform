import { Logger } from '@nestjs/common';
import { CourseClientDto, ICourseServiceClient } from '../CourseServiceClient.js';

export class LoggingCourseServiceDecorator implements ICourseServiceClient {
  private readonly logger = new Logger(LoggingCourseServiceDecorator.name);

  constructor(private readonly innerClient: ICourseServiceClient) {}

  async getCourse(courseId: string): Promise<CourseClientDto> {
    const startTime = Date.now();
    this.logger.log(`[DECORATOR: AUDIT START] Intercepted getCourse call for courseId="${courseId}"`);

    try {
      const result = await this.innerClient.getCourse(courseId);
      const duration = Date.now() - startTime;
      this.logger.log(
        `[DECORATOR: AUDIT SUCCESS] getCourse finished in ${duration}ms, verified=${result.isVerified}`,
      );
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `[DECORATOR: AUDIT FAILURE] getCourse failed after ${duration}ms: ${(error as Error).message}`,
      );
      throw error;
    }
  }
}
