import { describe, it, expect, vi } from 'vitest';
import { LoggingCourseServiceDecorator } from './LoggingCourseServiceDecorator.js';
import { CachingCourseServiceDecorator } from './CachingCourseServiceDecorator.js';
import { CourseClientDto, ICourseServiceClient } from '../CourseServiceClient.js';

describe('CourseServiceClient Decorators (Decorator Pattern)', () => {
  const sampleCourse: CourseClientDto = {
    id: 'c-100',
    title: 'Microservices & Patterns',
    isVerified: true,
    isAvailable: true,
  };

  it('LoggingCourseServiceDecorator should forward call and preserve result', async () => {
    const mockClient: ICourseServiceClient = {
      getCourse: vi.fn().mockResolvedValue(sampleCourse),
    };

    const decorator = new LoggingCourseServiceDecorator(mockClient);
    const result = await decorator.getCourse('c-100');

    expect(result).toEqual(sampleCourse);
    expect(mockClient.getCourse).toHaveBeenCalledWith('c-100');
  });

  it('CachingCourseServiceDecorator should cache verified response on repeated calls', async () => {
    const mockClient: ICourseServiceClient = {
      getCourse: vi.fn().mockResolvedValue(sampleCourse),
    };

    const cachingDecorator = new CachingCourseServiceDecorator(mockClient, 5000);

    // Call 1: cache miss
    const res1 = await cachingDecorator.getCourse('c-100');
    expect(res1).toEqual(sampleCourse);
    expect(mockClient.getCourse).toHaveBeenCalledTimes(1);

    // Call 2: cache hit (inner client NOT called again)
    const res2 = await cachingDecorator.getCourse('c-100');
    expect(res2).toEqual(sampleCourse);
    expect(mockClient.getCourse).toHaveBeenCalledTimes(1);
  });

  it('should allow composing multiple decorators (Chaining Decorators)', async () => {
    const mockClient: ICourseServiceClient = {
      getCourse: vi.fn().mockResolvedValue(sampleCourse),
    };

    // Chain: Logging -> Caching -> InnerClient
    const cachedClient = new CachingCourseServiceDecorator(mockClient);
    const loggedAndCachedClient = new LoggingCourseServiceDecorator(cachedClient);

    const result = await loggedAndCachedClient.getCourse('c-100');
    expect(result).toEqual(sampleCourse);
    expect(mockClient.getCourse).toHaveBeenCalledTimes(1);
  });
});
