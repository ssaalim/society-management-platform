'use client';

import { useEffect, useRef } from 'react';
import { API_BASE, societyHeaders } from '@/lib/api/client';

export interface ChatStreamEvent {
  type: 'message' | 'message_deleted' | 'channel' | 'ping';
  channelId?: string;
  [key: string]: any;
}

/**
 * Keeps one server-sent-events stream open while chat is on screen and hands each event to `onEvent`. Uses fetch (not
 * EventSource) so the session token goes in a header, never in the URL. Reconnects with back-off; `onReconnect` lets
 * the page reload what it may have missed while disconnected. The server pushes events, so nothing polls the database.
 */
export function useChatStream(onEvent: (e: ChatStreamEvent) => void, onReconnect: () => void, enabled = true) {
  const handler = useRef(onEvent);
  const reconnect = useRef(onReconnect);
  handler.current = onEvent;
  reconnect.current = onReconnect;

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let controller: AbortController | null = null;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const connect = async () => {
      if (stopped) return;
      controller = new AbortController();
      try {
        const res = await fetch(`${API_BASE}/chat/stream`, {
          headers: { ...societyHeaders(), Accept: 'text/event-stream' },
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!res.ok || !res.body) throw new Error(`Chat stream failed (${res.status})`);
        if (attempt > 0) reconnect.current();
        attempt = 0;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          // Events are separated by a blank line; each has one or more "data:" lines.
          let cut: number;
          while ((cut = buffer.indexOf('\n\n')) >= 0) {
            const chunk = buffer.slice(0, cut);
            buffer = buffer.slice(cut + 2);
            const data = chunk
              .split('\n')
              .filter((l) => l.startsWith('data:'))
              .map((l) => l.slice(5).trim())
              .join('\n');
            if (!data) continue;
            try {
              const event = JSON.parse(data) as ChatStreamEvent;
              if (event.type !== 'ping') handler.current(event);
            } catch {
              /* ignore a malformed event */
            }
          }
        }
      } catch {
        /* dropped or aborted: reconnect below unless stopped */
      }
      if (stopped) return;
      attempt += 1;
      timer = setTimeout(connect, Math.min(30_000, 1000 * 2 ** Math.min(attempt, 5)));
    };

    connect();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      controller?.abort();
    };
  }, [enabled]);
}
