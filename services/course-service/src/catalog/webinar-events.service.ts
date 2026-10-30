import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';

export interface PresenceEntry {
  userId: string;
  name: string;
  role: string;
  at: number;
}

export interface WebinarRealtimeEvent {
  type: 'webinar' | 'status' | 'chat' | 'deleted' | 'signal' | 'presence';
  webinarId?: string;
  status?: string;
  message?: unknown;
  webinar?: unknown;
  /** WebRTC signaling metadata */
  from?: string;
  fromRole?: string;
  fromName?: string;
  to?: string | null;
  signalType?: string;
  payload?: unknown;
  /** Кто сейчас в комнате */
  presence?: PresenceEntry[];
}

/**
 * In-process шина событий вебинаров для SSE.
 * Для нескольких инстансов достаточно заменить Subject на Redis Pub/Sub —
 * контракт событий остаётся тем же.
 */
@Injectable()
export class WebinarEventsService {
  private readonly subject = new Subject<WebinarRealtimeEvent>();
  private readonly rooms = new Map<string, Map<string, PresenceEntry>>();

  emit(event: WebinarRealtimeEvent): void {
    this.subject.next(event);
  }

  asObservable(): Observable<WebinarRealtimeEvent> {
    return this.subject.asObservable();
  }

  /** Отмечает участника онлайн и возвращает актуальный список комнаты. */
  touch(webinarId: string, entry: Omit<PresenceEntry, 'at'>): PresenceEntry[] {
    const room = this.rooms.get(webinarId) || new Map<string, PresenceEntry>();
    room.set(entry.userId, { ...entry, at: Date.now() });
    this.rooms.set(webinarId, room);
    return this.presenceFor(webinarId);
  }

  leave(webinarId: string, userId: string): PresenceEntry[] {
    const room = this.rooms.get(webinarId);
    if (room) room.delete(userId);
    return this.presenceFor(webinarId);
  }

  presenceFor(webinarId: string): PresenceEntry[] {
    const room = this.rooms.get(webinarId);
    if (!room) return [];
    const cutoff = Date.now() - 2 * 60 * 1000; // без heartbeat — 2 хвилини
    for (const [userId, entry] of room.entries()) {
      if (entry.at < cutoff) room.delete(userId);
    }
    return Array.from(room.values()).sort((a, b) => a.name.localeCompare(b.name));
  }
}
