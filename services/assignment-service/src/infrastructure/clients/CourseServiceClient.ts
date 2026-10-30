import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import jwt from 'jsonwebtoken';

export const COURSE_SERVICE_CLIENT_TOKEN = Symbol('COURSE_SERVICE_CLIENT_TOKEN');

export interface CourseClientDto {
  id: string;
  title: string;
  isPublished?: boolean;
  isVerified: boolean;
  isAvailable: boolean;
  fallbackNotice?: string;
}

export interface ICourseServiceClient {
  getCourse(courseId: string): Promise<CourseClientDto>;
}

@Injectable()
export class CourseServiceClient implements ICourseServiceClient {
  private readonly logger = new Logger(CourseServiceClient.name);
  private readonly courseServiceUrl: string;
  private readonly timeoutMs = 2000; // 2 seconds timeout constraint

  constructor(private readonly configService: ConfigService) {
    this.courseServiceUrl = this.configService.get<string>(
      'COURSE_SERVICE_URL',
      'http://localhost:3001',
    );
  }

  /** Short-lived service-to-service token (course-service verifies the signature). */
  private signInternalToken(): string {
    const secret = this.configService.get<string>(
      'JWT_SECRET',
      'change_me_super_long_random_secret_at_least_32_chars',
    );
    return jwt.sign(
      {
        sub: 'system:assignment-service',
        email: 'internal@studevo.local',
        role: 'ADMIN',
        name: 'Assignment Service',
      },
      secret,
      { expiresIn: '2m' },
    );
  }

  async getCourse(courseId: string): Promise<CourseClientDto> {
    const url = `${this.courseServiceUrl}/courses/${courseId}`;
    this.logger.log(`[SYNC CALL] Requesting course details from: ${url} (Timeout: ${this.timeoutMs}ms)`);

    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${this.signInternalToken()}` },
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        throw new Error(`Course service responded with status ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      this.logger.log(`[SYNC SUCCESS] Received course info: "${data.title}" (ID: ${data.id})`);

      return {
        id: data.id,
        title: data.title,
        isPublished: data.isPublished,
        isVerified: true,
        isAvailable: true,
      };
    } catch (error) {
      // FALLBACK & GRACEFUL DEGRADATION:
      // When Course Service is offline or timed out, do not crash the caller!
      const errorMsg = (error as Error).message;
      this.logger.warn(
        `[FALLBACK ACTIVATED] Synchronous call to Course Service failed: ${errorMsg}. Using graceful degradation fallback!`,
      );

      return {
        id: courseId,
        title: 'Course (Offline / Verification Pending)',
        isPublished: false,
        isVerified: false,
        isAvailable: false,
        fallbackNotice: `Course service was unreachable (${errorMsg}). Cached default used.`,
      };
    }
  }
}
