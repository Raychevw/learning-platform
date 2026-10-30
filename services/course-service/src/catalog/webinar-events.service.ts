import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';

export interface WebinarRealtimeEvent {
  type: 'webinar' | 'status' | 'chat' | 'deleted';
  webinarId?: string;
  status?: string;
  message?: unknown;
  webinar?: unknown;
}

/**
 * In-process шина событий вебинаров для SSE.
 * Для нескольких инстансов достаточно заменить Subject на Redis Pub/Sub —
 * контракт событий остаётся тем же.
 */
@Injectable()
export class WebinarEventsService {
  private readonly subject = new Subject<WebinarRealtimeEvent>();

  emit(event: WebinarRealtimeEvent): void {
    this.subject.next(event);
  }

  asObservable(): Observable<WebinarRealtimeEvent> {
    return this.subject.asObservable();
  }
}
