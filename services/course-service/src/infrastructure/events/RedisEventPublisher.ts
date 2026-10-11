import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { IEventPublisher } from '../../application/course/EventPublisher.interface.js';

@Injectable()
export class RedisEventPublisher implements IEventPublisher, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisEventPublisher.name);
  private redisClient: Redis | null = null;
  private isConnected = false;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const host = this.configService.get<string>('REDIS_HOST', 'localhost');
    const port = this.configService.get<number>('REDIS_PORT', 6379);

    try {
      this.redisClient = new Redis({
        host,
        port,
        lazyConnect: true,
        retryStrategy: (times) => {
          if (times > 3) {
            this.logger.warn(`Redis unavailable at ${host}:${port}. Event publishing will be buffered/skipped.`);
            return null; // Stop retrying after 3 attempts
          }
          return 1000;
        },
      });

      this.redisClient.on('connect', () => {
        this.isConnected = true;
        this.logger.log(`Connected to Redis message broker at ${host}:${port}`);
      });

      this.redisClient.on('error', (err) => {
        this.isConnected = false;
        this.logger.warn(`Redis connection error: ${err.message}`);
      });

      this.redisClient.connect().catch((err) => {
        this.logger.warn(`Initial Redis connection failed: ${err.message}. Running in fallback event mode.`);
      });
    } catch (err) {
      this.logger.warn(`Could not initialize Redis client: ${(err as Error).message}`);
    }
  }

  async publish(channel: string, message: any): Promise<void> {
    const payload = typeof message === 'string' ? message : JSON.stringify(message);
    this.logger.log(`[EVENT PUBLISHED] Channel: '${channel}', Payload: ${payload}`);

    if (this.redisClient && this.isConnected) {
      try {
        await this.redisClient.publish(channel, payload);
      } catch (err) {
        this.logger.warn(`Error publishing event to Redis: ${(err as Error).message}`);
      }
    } else {
      this.logger.warn(`Redis broker not connected. Event was logged locally (fallback).`);
    }
  }

  async onModuleDestroy() {
    if (this.redisClient) {
      try {
        await this.redisClient.quit();
      } catch {
        // ignore on shutdown
      }
    }
  }
}
