import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebinarEntity, WebinarStatus, ChatMessage } from '../../infrastructure/database/entities/WebinarEntity.js';
import { Redis } from 'ioredis';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WebinarService {
  private readonly logger = new Logger(WebinarService.name);
  private redisClient: any = null;

  constructor(
    @InjectRepository(WebinarEntity)
    private readonly webinarRepo: Repository<WebinarEntity>,
    private readonly configService: ConfigService,
  ) {
    const host = this.configService.get<string>('REDIS_HOST', 'localhost');
    const port = this.configService.get<number>('REDIS_PORT', 6379);
    try {
      this.redisClient = new Redis({ host, port, maxRetriesPerRequest: 1, retryStrategy: () => null });
      this.redisClient.on('error', () => {
        this.redisClient = null;
      });
    } catch {
      this.redisClient = null;
    }
  }

  async scheduleWebinar(courseId: string, title: string, scheduledAt: Date): Promise<WebinarEntity> {
    const meetingUrl = `https://meet.univ.edu.ua/rooms/${courseId}-${Date.now()}`;
    const webinar = this.webinarRepo.create({
      course_id: courseId,
      title,
      scheduled_at: scheduledAt,
      meeting_url: meetingUrl,
      status: WebinarStatus.SCHEDULED,
      chat_history_json: [],
    });
    return this.webinarRepo.save(webinar);
  }

  async setWebinarStatus(webinarId: string, status: WebinarStatus): Promise<WebinarEntity> {
    const webinar = await this.webinarRepo.findOne({ where: { id: webinarId } });
    if (!webinar) throw new NotFoundException('Вебінар не знайдено');
    webinar.status = status;
    this.logger.log(`[WEBINAR STATUS UPDATE] Room ${webinarId} status set to: ${status}`);
    return this.webinarRepo.save(webinar);
  }

  /**
   * Fast chat buffering in Redis during live pair, with persistence into JSONB
   * Fulfills Quality Scenario 3 (zero chat loss during reconnect)
   */
  async postChatMessage(webinarId: string, senderId: string, senderName: string, message: string): Promise<ChatMessage> {
    const chatMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender_id: senderId,
      sender_name: senderName,
      message,
      timestamp: new Date().toISOString(),
    };

    // Buffer in Redis
    if (this.redisClient) {
      try {
        await this.redisClient.rpush(`webinar:chat:${webinarId}`, JSON.stringify(chatMsg));
        this.logger.log(`[REDIS CHAT BUFFER] Buffered message from ${senderName} in room ${webinarId}`);
      } catch {
        // Ignore redis fail
      }
    }

    // Persist into PostgreSQL JSONB
    const webinar = await this.webinarRepo.findOne({ where: { id: webinarId } });
    if (webinar) {
      const history = webinar.chat_history_json || [];
      history.push(chatMsg);
      webinar.chat_history_json = history;
      await this.webinarRepo.save(webinar);
    }

    return chatMsg;
  }

  async getWebinarChat(webinarId: string): Promise<ChatMessage[]> {
    if (this.redisClient) {
      try {
        const buffered = await this.redisClient.lrange(`webinar:chat:${webinarId}`, 0, -1);
        if (buffered && buffered.length > 0) {
          return buffered.map((item: string) => JSON.parse(item));
        }
      } catch {
        // Fallback
      }
    }

    const webinar = await this.webinarRepo.findOne({ where: { id: webinarId } });
    return webinar?.chat_history_json || [];
  }

  async getWebinarsByCourse(courseId: string): Promise<WebinarEntity[]> {
    return this.webinarRepo.find({ where: { course_id: courseId }, order: { scheduled_at: 'ASC' } });
  }
}
