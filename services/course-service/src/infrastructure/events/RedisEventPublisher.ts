import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { IEventPublisher } from '../../application/course/EventPublisher.interface.js';
import { IMessageBroker } from './adapters/MessageBroker.interface.js';
import { RedisBrokerAdapter } from './adapters/RedisBrokerAdapter.js';

@Injectable()
export class RedisEventPublisher implements IEventPublisher, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisEventPublisher.name);
  private broker: IMessageBroker | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const host = this.configService.get<string>('REDIS_HOST', 'localhost');
    const port = this.configService.get<number>('REDIS_PORT', 6379);

    try {
      const redisClient = new Redis({
        host,
        port,
        lazyConnect: true,
        retryStrategy: (times) => {
          if (times > 3) {
            this.logger.warn(`Redis unavailable at ${host}:${port}. Event publishing will fallback locally.`);
            return null;
          }
          return 1000;
        },
      });

      // Wrap Adaptee (Redis) with Adapter (RedisBrokerAdapter)
      this.broker = new RedisBrokerAdapter(redisClient);

      redisClient.connect().catch((err) => {
        this.logger.warn(`Initial Redis connection failed: ${err.message}. Running in local fallback event mode.`);
      });
    } catch (err) {
      this.logger.warn(`Could not initialize broker adapter: ${(err as Error).message}`);
    }
  }

  async publish(channel: string, message: any): Promise<void> {
    const payload = typeof message === 'string' ? message : JSON.stringify(message);
    this.logger.log(`[EVENT PUBLISHED] Channel: '${channel}', Payload: ${payload}`);

    if (this.broker && this.broker.isConnected()) {
      try {
        await this.broker.publish(channel, payload);
      } catch (err) {
        this.logger.warn(`Error publishing event via broker adapter: ${(err as Error).message}`);
      }
    } else {
      this.logger.warn(`Broker not connected. Event was logged locally (fallback).`);
    }
  }

  async onModuleDestroy() {
    if (this.broker) {
      await this.broker.disconnect();
    }
  }
}
