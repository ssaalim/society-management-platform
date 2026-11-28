'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ImagePlus, Loader2, MessageSquarePlus, MicOff, Reply, Send, ShieldCheck, Trash2, Users, X } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { uploadFileToR2 } from '@/lib/utils/upload';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { ChatStreamEvent, useChatStream } from './use-chat-stream';

interface ChannelRow {
  id: string;
  type: 'SOCIETY' | 'COMMITTEE' | 'DIRECT';
  title: string;
  other: { userId: string; name: string } | null;
  unread: number;
  last: { body: string | null; photo: boolean; at: string; sender: string | null; deleted: boolean } | null;
}

interface Me {
  userId: string;
  name: string;
  isCommittee: boolean;
  mutedUntil: string | null;
}

interface Message {
  id: string;
  channelId: string;
  senderId: string | null;
  senderName: string;
  senderRole: string | null;
  body: string | null;
  photoUrl: string | null;
  replyTo: { id: string; body: string | null; photo: boolean; sender: string | null; deleted: boolean } | null;
  createdAt: string;
  deletedAt: string | null;
  removedByModerator: boolean;
}

interface Thread {
  channelId: string;
  messages: Message[];
  hasMore: boolean;
  canPost: boolean;
  cannotPostReason: string | null;
  canModerate: boolean;
}

const COMMITTEE_ROLES = ['PRESIDENT', 'VICE_PRESIDENT', 'SECRETARY', 'JOINT_SECRETARY', 'TREASURER', 'CULTURAL_SECRETARY', 'COMMITTEE_MEMBER', 'COMMITTEE', 'SOCIETY_ADMIN'];
const roleLabel = (r: string | null) => (r ? r.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : '');
const errText = (err: any, fallback: string) => {
  const m = err?.response?.data?.message;
  return (Array.isArray(m) ? m.join(' ') : m) || err?.message || fallback;
};
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' });
const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const fmt = (x: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(x);
  if (fmt(d) === fmt(new Date())) return 'Today';
  if (fmt(d) === fmt(new Date(Date.now() - 86400_000))) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short' });
};
const preview = (c: ChannelRow) =>
  !c.last ? 'No messages yet' : c.last.deleted ? 'Message removed' : `${c.last.sender ? `${c.last.sender.split(' (')[0]}: ` : ''}${c.last.body || (c.last.photo ? '📷 Photo' : '')}`;

export function ChatView() {
  const [me, setMe] = useState<Me | null>(null);
  const [channels, setChannels] = useState<ChannelRow[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [thread, setThread] = useState<Thread | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showList, setShowList] = useState(true); // phones show one pane at a time
  const [newChat, setNewChat] = useState(false);
  const [muting, setMuting] = useState<Message | null>(null);
  const activeRef = useRef<string | null>(null);
  activeRef.current = activeId;

  const loadChannels = useCallback(async () => {
    try {
      const res = await apiClient.get('/chat/channels');
      setMe(res.data.data.me);
      setChannels(res.data.data.channels);
      return res.data.data.channels as ChannelRow[];
    } catch (err) {
      setError(errText(err, 'Could not load chat.'));
      return [];
    }
  }, []);

  const loadThread = useCallback(async (channelId: string) => {
    try {
      const res = await apiClient.get(`/chat/channels/${channelId}/messages`);
      const d = res.data.data;
      setThread({ channelId, messages: d.messages, hasMore: d.hasMore, canPost: d.canPost, cannotPostReason: d.cannotPostReason, canModerate: d.canModerate });
      apiClient.post(`/chat/channels/${channelId}/read`).catch(() => null);
      setChannels((cs) => cs?.map((c) => (c.id === channelId ? { ...c, unread: 0 } : c)) || cs);
    } catch (err) {
      setError(errText(err, 'Could not load the conversation.'));
    }
  }, []);

  useEffect(() => {
    loadChannels().then((cs) => {
      if (cs.length && !activeRef.current) {
        setActiveId(cs[0].id);
        if (typeof window !== 'undefined' && window.innerWidth >= 768) setShowList(false);
      }
    });
  }, [loadChannels]);

  useEffect(() => {
    if (activeId) {
      setThread(null);
      loadThread(activeId);
    }
  }, [activeId, loadThread]);

  // Live updates pushed by the server.
  const onEvent = useCallback(
    (e: ChatStreamEvent) => {
      if (e.type === 'message' && e.message) {
        const m = e.message as Message;
        if (m.channelId === activeRef.current) {
          setThread((t) => (t && t.channelId === m.channelId && !t.messages.some((x) => x.id === m.id) ? { ...t, messages: [...t.messages, m] } : t));
          if (m.senderId !== me?.userId && document.visibilityState === 'visible') apiClient.post(`/chat/channels/${m.channelId}/read`).catch(() => null);
        }
        setChannels((cs) => {
          if (!cs) return cs;
          if (!cs.some((c) => c.id === m.channelId)) {
            loadChannels(); // a new private chat
            return cs;
          }
          const updated = cs.map((c) =>
            c.id === m.channelId
              ? {
                  ...c,
                  unread: m.channelId === activeRef.current || m.senderId === me?.userId ? 0 : c.unread + 1,
                  last: { body: m.body, photo: !!m.photoUrl, at: m.createdAt, sender: m.senderName, deleted: false },
                }
              : c,
          );
          return updated;
        });
      }
      if (e.type === 'message_deleted' && e.channelId === activeRef.current) {
        setThread((t) =>
          t ? { ...t, messages: t.messages.map((x) => (x.id === e.messageId ? { ...x, body: null, photoUrl: null, deletedAt: new Date().toISOString(), removedByModerator: !!e.byModerator } : x)) } : t,
        );
      }
    },
    [me?.userId, loadChannels],
  );
  const onReconnect = useCallback(() => {
    loadChannels();
    if (activeRef.current) loadThread(activeRef.current);
  }, [loadChannels, loadThread]);
  useChatStream(onEvent, onReconnect, !!me);

  const active = channels?.find((c) => c.id === activeId) || null;
  const open = (id: string) => {
    setActiveId(id);
    setShowList(false);
  };

  const loadOlder = async () => {
    if (!thread || !thread.messages.length) return;
    const res = await apiClient.get(`/chat/channels/${thread.channelId}/messages`, { params: { before: thread.messages[0].createdAt } });
    const d = res.data.data;
    setThread((t) => (t && t.channelId === thread.channelId ? { ...t, messages: [...d.messages, ...t.messages], hasMore: d.hasMore } : t));
  };

  return (
    <div className="flex h-[calc(100dvh-7.5rem)] min-h-[420px] overflow-hidden rounded-md border bg-card">
      {/* Conversations */}
      <aside className={`${showList ? 'flex' : 'hidden'} w-full flex-col border-r md:flex md:w-72`} aria-label="Conversations">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
          <h1 className="text-base font-medium">Chat</h1>
          {me?.isCommittee && (
            <Button size="sm" variant="ghost" onClick={() => setNewChat(true)} aria-label="New private chat">
              <MessageSquarePlus />
            </Button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {!channels ? (
            <Loader2 className="m-4 h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            channels.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => open(c.id)}
                aria-current={c.id === activeId ? 'true' : undefined}
                className={`flex w-full items-start gap-2.5 border-b px-3 py-2.5 text-left hover:bg-muted/50 ${c.id === activeId ? 'bg-muted' : ''}`}
              >
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                  {c.type === 'SOCIETY' ? <Users className="h-4 w-4" /> : c.type === 'COMMITTEE' ? <ShieldCheck className="h-4 w-4" /> : c.title.replace(/\(.*\)/, '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('')}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{c.title}</span>
                    {c.unread > 0 && <Badge variant="default" className="rounded-full px-1.5">{c.unread > 99 ? '99+' : c.unread}</Badge>}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{preview(c)}</span>
                </span>
              </button>
            ))
          )}
        </div>
        {!me?.isCommittee && me && <p className="border-t px-3 py-2 text-xs text-muted-foreground">Private chats can be started by committee members.</p>}
      </aside>

      {/* Conversation */}
      <section className={`${showList ? 'hidden' : 'flex'} min-w-0 flex-1 flex-col md:flex`} aria-label={active?.title || 'Conversation'}>
        {error && (
          <div role="alert" className="border-b bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {error}
            <button type="button" className="ml-2 underline" onClick={() => setError(null)}>
              Dismiss
            </button>
          </div>
        )}
        {!active ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Choose a conversation.</div>
        ) : (
          <>
            <header className="flex items-center gap-2 border-b px-3 py-2.5">
              <Button size="icon-sm" variant="ghost" className="md:hidden" onClick={() => setShowList(true)} aria-label="Back to conversations">
                <ArrowLeft />
              </Button>
              <div className="min-w-0">
                <div className="truncate font-medium">{active.title}</div>
                <div className="text-xs text-muted-foreground">
                  {active.type === 'SOCIETY' ? 'Everyone in the society' : active.type === 'COMMITTEE' ? 'Managing committee only' : 'Private chat'}
                  {thread?.canModerate && ' · you can moderate'}
                </div>
              </div>
            </header>
            {!thread ? (
              <div className="flex flex-1 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Conversation
                key={thread.channelId}
                thread={thread}
                me={me!}
                onLoadOlder={loadOlder}
                onError={setError}
                onMute={setMuting}
                onRemoved={(id, byModerator) =>
                  setThread((t) => (t ? { ...t, messages: t.messages.map((x) => (x.id === id ? { ...x, body: null, photoUrl: null, deletedAt: new Date().toISOString(), removedByModerator: byModerator } : x)) } : t))
                }
                onSent={(m) => setThread((t) => (t && !t.messages.some((x) => x.id === m.id) ? { ...t, messages: [...t.messages, m] } : t))}
              />
            )}
          </>
        )}
      </section>

      {newChat && (
        <NewChatDialog
          onClose={() => setNewChat(false)}
          onOpened={async (id) => {
            setNewChat(false);
            await loadChannels();
            open(id);
          }}
        />
      )}
      {muting && (
        <MuteDialog
          message={muting}
          onClose={() => setMuting(null)}
          onDone={(text) => {
            setMuting(null);
            setError(null);
            alertOk(text);
          }}
          onError={setError}
        />
      )}
    </div>
  );
}

/** Small transient confirmation for moderation actions. */
function alertOk(text: string) {
  if (typeof window === 'undefined') return;
  const el = document.createElement('div');
  el.setAttribute('role', 'status');
  el.className = 'fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md bg-slate-900 px-3 py-2 text-sm text-white shadow-lg dark:bg-slate-100 dark:text-slate-900';
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function Conversation({
  thread,
  me,
  onLoadOlder,
  onError,
  onMute,
  onRemoved,
  onSent,
}: {
  thread: Thread;
  me: Me;
  onLoadOlder: () => Promise<void>;
  onError: (e: string) => void;
  onMute: (m: Message) => void;
  onRemoved: (id: string, byModerator: boolean) => void;
  onSent: (m: Message) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const lastCount = useRef(0);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);

  // Stay at the bottom when new messages arrive (if the reader was already there); keep position when loading older ones.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const grewAtTop = lastCount.current > 0 && thread.messages.length > lastCount.current && loadingOlder;
    if (!grewAtTop && (atBottom.current || lastCount.current === 0)) el.scrollTop = el.scrollHeight;
    lastCount.current = thread.messages.length;
  }, [thread.messages, loadingOlder]);

  const older = async () => {
    const el = scroller.current;
    const before = el ? el.scrollHeight - el.scrollTop : 0;
    setLoadingOlder(true);
    await onLoadOlder();
    requestAnimationFrame(() => {
      if (el) el.scrollTop = el.scrollHeight - before;
      setLoadingOlder(false);
    });
  };

  const remove = async (m: Message) => {
    const own = m.senderId === me.userId;
    if (!window.confirm(own ? 'Remove your message?' : `Remove this message by ${m.senderName}? It is kept in the audit log.`)) return;
    try {
      await apiClient.delete(`/chat/messages/${m.id}`);
      onRemoved(m.id, !own);
    } catch (err) {
      onError(errText(err, 'Could not remove the message.'));
    }
  };

  const items = useMemo(() => {
    const out: ({ kind: 'day'; label: string; key: string } | { kind: 'msg'; m: Message; showName: boolean })[] = [];
    let lastDay = '';
    let lastSender: string | null = null;
    let lastAt = 0;
    for (const m of thread.messages) {
      const day = dayLabel(m.createdAt);
      if (day !== lastDay) {
        out.push({ kind: 'day', label: day, key: `d-${m.id}` });
        lastDay = day;
        lastSender = null;
      }
      const at = new Date(m.createdAt).getTime();
      out.push({ kind: 'msg', m, showName: m.senderId !== lastSender || at - lastAt > 10 * 60_000 });
      lastSender = m.senderId;
      lastAt = at;
    }
    return out;
  }, [thread.messages]);

  return (
    <>
      <div
        ref={scroller}
        className="flex-1 space-y-1 overflow-y-auto px-3 py-3"
        onScroll={(e) => {
          const el = e.currentTarget;
          atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        aria-live="polite"
      >
        {thread.hasMore && (
          <div className="pb-2 text-center">
            <Button size="sm" variant="ghost" disabled={loadingOlder} onClick={older}>
              {loadingOlder ? <Loader2 className="animate-spin" /> : null} Earlier messages
            </Button>
          </div>
        )}
        {thread.messages.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No messages yet. Say hello!</p>}
        {items.map((it) =>
          it.kind === 'day' ? (
            <div key={it.key} className="py-2 text-center text-xs text-muted-foreground">
              {it.label}
            </div>
          ) : (
            <Bubble
              key={it.m.id}
              m={it.m}
              mine={it.m.senderId === me.userId}
              showName={it.showName}
              canRemove={!it.m.deletedAt && (it.m.senderId === me.userId || thread.canModerate)}
              canMute={thread.canModerate && it.m.senderId !== me.userId && !COMMITTEE_ROLES.includes(it.m.senderRole || '') && !it.m.deletedAt}
              onReply={() => setReplyTo(it.m)}
              onRemove={() => remove(it.m)}
              onMute={() => onMute(it.m)}
            />
          ),
        )}
      </div>
      <Composer
        channelId={thread.channelId}
        canPost={thread.canPost}
        reason={thread.cannotPostReason}
        replyTo={replyTo}
        onClearReply={() => setReplyTo(null)}
        onSent={(m) => {
          atBottom.current = true;
          setReplyTo(null);
          onSent(m);
        }}
        onError={onError}
      />
    </>
  );
}

function Bubble({
  m,
  mine,
  showName,
  canRemove,
  canMute,
  onReply,
  onRemove,
  onMute,
}: {
  m: Message;
  mine: boolean;
  showName: boolean;
  canRemove: boolean;
  canMute: boolean;
  onReply: () => void;
  onRemove: () => void;
  onMute: () => void;
}) {
  const committee = COMMITTEE_ROLES.includes(m.senderRole || '');
  return (
    <div className={`group flex ${mine ? 'justify-end' : 'justify-start'} ${showName ? 'pt-2' : ''}`}>
      <div className={`max-w-[85%] sm:max-w-[70%] ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
        {showName && !mine && (
          <div className="mb-0.5 flex items-center gap-1.5 px-1 text-xs">
            <span className="font-medium">{m.senderName.replace(/\s*\(.*\)$/, '')}</span>
            {committee && <Badge variant="info" className="px-1 py-0 text-[10px]">{roleLabel(m.senderRole)}</Badge>}
          </div>
        )}
        <div
          className={`rounded-lg px-3 py-2 text-sm ${
            m.deletedAt ? 'border border-dashed bg-transparent italic text-muted-foreground' : mine ? 'bg-brand-600 text-white' : 'bg-muted'
          }`}
        >
          {m.deletedAt ? (
            m.removedByModerator ? 'Message removed by a moderator' : 'Message deleted'
          ) : (
            <>
              {m.replyTo && (
                <div className={`mb-1.5 border-l-2 pl-2 text-xs ${mine ? 'border-white/60 text-white/80' : 'border-brand-400 text-muted-foreground'}`}>
                  <span className="font-medium">{(m.replyTo.sender || '').replace(/\s*\(.*\)$/, '')}</span>: {m.replyTo.deleted ? 'removed message' : m.replyTo.body || (m.replyTo.photo ? 'Photo' : '')}
                </div>
              )}
              {m.photoUrl && (
                <a href={m.photoUrl} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.photoUrl} alt="Photo shared in chat" className="mb-1 max-h-64 rounded-md object-cover" loading="lazy" />
                </a>
              )}
              {m.body && <div className="whitespace-pre-wrap break-words">{m.body}</div>}
            </>
          )}
        </div>
        <div className="flex items-center gap-1 px-1 text-[11px] text-muted-foreground">
          <span>{time(m.createdAt)}</span>
          {!m.deletedAt && (
            <span className="flex opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
              <button type="button" className="rounded p-1 hover:bg-muted" onClick={onReply} aria-label="Reply">
                <Reply className="h-3.5 w-3.5" />
              </button>
              {canRemove && (
                <button type="button" className="rounded p-1 hover:bg-muted" onClick={onRemove} aria-label={mine ? 'Delete message' : 'Remove message'}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
              {canMute && (
                <button type="button" className="rounded p-1 hover:bg-muted" onClick={onMute} aria-label={`Pause ${m.senderName} from posting`}>
                  <MicOff className="h-3.5 w-3.5" />
                </button>
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function Composer({
  channelId,
  canPost,
  reason,
  replyTo,
  onClearReply,
  onSent,
  onError,
}: {
  channelId: string;
  canPost: boolean;
  reason: string | null;
  replyTo: Message | null;
  onClearReply: () => void;
  onSent: (m: Message) => void;
  onError: (e: string) => void;
}) {
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<{ url: string; key: string; preview: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (replyTo) textRef.current?.focus();
  }, [replyTo]);

  if (!canPost) {
    return <div className="border-t bg-muted/40 px-3 py-3 text-sm text-muted-foreground">{reason || 'You cannot post here.'}</div>;
  }

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const up = await uploadFileToR2({ file, fileType: 'chat_photo' });
      setPhoto({ url: up.publicUrl, key: up.fileKey, preview: URL.createObjectURL(up.prepared?.file || file) });
    } catch (err) {
      onError(errText(err, 'Could not upload the photo.'));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const send = async () => {
    const body = text.trim();
    if (!body && !photo) return;
    setBusy(true);
    try {
      const res = await apiClient.post(`/chat/channels/${channelId}/messages`, {
        body: body || null,
        photoUrl: photo?.url || null,
        photoKey: photo?.key || null,
        replyToId: replyTo?.id || null,
      });
      setText('');
      setPhoto(null);
      onSent(res.data.data);
    } catch (err) {
      onError(errText(err, 'Message not sent.'));
    } finally {
      setBusy(false);
      textRef.current?.focus();
    }
  };

  return (
    <div className="border-t p-2">
      {replyTo && (
        <div className="mb-1.5 flex items-center justify-between gap-2 rounded-md bg-muted px-2 py-1 text-xs">
          <span className="truncate">
            Replying to <span className="font-medium">{replyTo.senderName.replace(/\s*\(.*\)$/, '')}</span>: {replyTo.body || 'Photo'}
          </span>
          <button type="button" onClick={onClearReply} aria-label="Cancel reply" className="rounded p-0.5 hover:bg-background">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {photo && (
        <div className="mb-1.5 flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.preview} alt="Photo to send" className="h-16 w-16 rounded-md object-cover" />
          <Button size="sm" variant="ghost" onClick={() => setPhoto(null)}>
            Remove photo
          </Button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        <Button size="icon" variant="ghost" disabled={busy} onClick={() => fileRef.current?.click()} aria-label="Add a photo">
          <ImagePlus />
        </Button>
        <Textarea
          ref={textRef}
          rows={1}
          aria-label="Message"
          placeholder="Write a message…"
          className="max-h-32 min-h-[40px] flex-1 resize-none"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <Button size="icon" disabled={busy || (!text.trim() && !photo)} onClick={send} aria-label="Send">
          {busy ? <Loader2 className="animate-spin" /> : <Send />}
        </Button>
      </div>
    </div>
  );
}

function NewChatDialog({ onClose, onOpened }: { onClose: () => void; onOpened: (id: string) => void }) {
  const [people, setPeople] = useState<{ userId: string; name: string; role: string; flat: string | null }[] | null>(null);
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    apiClient
      .get('/chat/people')
      .then((res) => setPeople(res.data.data))
      .catch((err) => setError(errText(err, 'Could not load members.')));
  }, []);
  const shown = (people || []).filter((p) => `${p.name} ${p.flat || ''}`.toLowerCase().includes(q.toLowerCase()));
  const start = async (userId: string) => {
    try {
      const res = await apiClient.post(`/chat/direct/${userId}`);
      onOpened(res.data.data.id);
    } catch (err) {
      setError(errText(err, 'Could not start the chat.'));
    }
  };
  return (
    <Dialog open onOpenChange={(o: boolean) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New private chat</DialogTitle>
          <DialogDescription>As a committee member you can message any member privately. They can reply to you.</DialogDescription>
        </DialogHeader>
        <Input aria-label="Search members" placeholder="Search by name or flat" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="max-h-72 overflow-y-auto rounded-md border">
          {!people ? (
            <Loader2 className="m-3 h-4 w-4 animate-spin text-muted-foreground" />
          ) : shown.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">No one found.</p>
          ) : (
            shown.map((p) => (
              <button key={p.userId} type="button" className="flex w-full items-center justify-between gap-2 border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted/50" onClick={() => start(p.userId)}>
                <span>{p.name}</span>
                <span className="text-xs text-muted-foreground">{[p.flat, roleLabel(p.role)].filter(Boolean).join(' · ')}</span>
              </button>
            ))
          )}
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </DialogContent>
    </Dialog>
  );
}

function MuteDialog({ message, onClose, onDone, onError }: { message: Message; onClose: () => void; onDone: (text: string) => void; onError: (e: string) => void }) {
  const [hours, setHours] = useState('24');
  const [reason, setReason] = useState('');
  const name = message.senderName.replace(/\s*\(.*\)$/, '');
  const save = async () => {
    try {
      await apiClient.post(`/chat/mutes/${message.senderId}`, { hours: Number(hours), reason: reason.trim() || null });
      onDone(`${name} can't post in the society group for now.`);
    } catch (err) {
      onError(errText(err, 'Could not pause posting.'));
      onClose();
    }
  };
  return (
    <Dialog open onOpenChange={(o: boolean) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pause {name} from posting?</DialogTitle>
          <DialogDescription>They can still read the group and reply to committee members privately. They see the reason.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="mute-for">For</Label>
            <NativeSelect id="mute-for" value={hours} onChange={(e) => setHours(e.target.value)}>
              <option value="1">1 hour</option>
              <option value="24">1 day</option>
              <option value="168">1 week</option>
              <option value="720">30 days</option>
            </NativeSelect>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="mute-reason">Reason (shown to them)</Label>
            <Input id="mute-reason" value={reason} placeholder="e.g. Repeated off-topic posts" onChange={(e) => setReason(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={save}>
            Pause posting
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
