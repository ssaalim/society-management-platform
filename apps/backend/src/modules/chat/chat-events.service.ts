import { Injectable, Logger } from '@nestjs/common';
import { Subject } from 'rxjs';

export interface ChatEvent {
  type: 'message' | 'message_deleted' | 'channel' | 'ping';
  channelId?: string;
  [key: string]: any;
}

/** Who an event is for: everyone in the society, the committee, or particular people. */
export interface Audience {
  societyId: string;
  channelType: 'SOCIETY' | 'COMMITTEE' | 'DIRECT';
  userIds?: string[];
}

interface Subscriber {
  userId: string;
  societyId: string;
  isCommittee: boolean;
  stream: Subject<ChatEvent>;
}

/**
 * Pushes chat events to open chat screens over server-sent events, so clients never poll. Subscriptions live in this
 * process; with several API servers, a Redis pub/sub relay would be needed so every server hears every message.
 */
@Injectable()
export class ChatEvents {
  private readonly logger = new Logger(ChatEvents.name);
  private readonly subscribers = new Map<number, Subscriber>();
  private nextId = 1;

  subscribe(userId: string, societyId: string, isCommittee: boolean) {
    const id = this.nextId++;
    const stream = new Subject<ChatEvent>();
    this.subscribers.set(id, { userId, societyId, isCommittee, stream });
    return {
      stream,
      close: () => {
        stream.complete();
        this.subscribers.delete(id);
      },
    };
  }

  publish(event: ChatEvent, to: Audience) {
    let delivered = 0;
    for (const s of this.subscribers.values()) {
      if (s.societyId !== to.societyId) continue;
      const wanted =
        to.channelType === 'SOCIETY' ? true : to.channelType === 'COMMITTEE' ? s.isCommittee : (to.userIds || []).includes(s.userId);
      if (!wanted) continue;
      s.stream.next(event);
      delivered++;
    }
    return delivered;
  }

  get openStreams() {
    return this.subscribers.size;
  }
}
