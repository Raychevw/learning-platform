import { Redis } from 'ioredis';
import { Logger } from '@nestjs/common';
import { IMessageBroker } from './MessageBroker.interface.js';

export class RedisBrokerAdapter implements IMessageBroker {
  private readonly logger = new Logger(RedisBrokerAdapter.name);
  private connected = false;

  constructor(private readonly redisClient: Redis) {
    this.redisClient.on('connect', () => {
      this.connected = true;
      this.logger.log('Redis broker adapter connected successfully');
    });

    this.redisClient.on('error', (err) => {
      this.connected = false;
      this.logger.warn(`Redis broker adapter error: ${err.message}`);
    });
  }

  async publish(topic: string, message: string): Promise<void> {
    if (!this.connected) {
      throw new Error(`Cannot publish to topic ${topic}: Redis broker is not connected`);
    }
    await this.redisClient.publish(topic, message);
  }

  isConnected(): boolean {
    return this.connected;
  }

  async disconnect(): Promise<void> {
    try {
      await this.redisClient.quit();
    } catch {
      // ignore on shutdown
    }
  }
}
