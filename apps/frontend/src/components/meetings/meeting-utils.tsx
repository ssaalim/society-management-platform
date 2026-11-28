'use client';

import { Badge } from '@/components/ui/badge';

export type MeetingStatus = 'DRAFT' | 'SCHEDULED' | 'HELD' | 'CANCELLED';
export type Rsvp = 'ATTENDING' | 'NOT_ATTENDING' | 'TENTATIVE';

export const MEETING_TYPES = [
  { value: 'AGM', label: 'Annual General Meeting' },
  { value: 'EGM', label: 'Special General Meeting' },
  { value: 'GENERAL', label: 'General meeting' },
  { value: 'COMMITTEE', label: 'Committee meeting' },
];

export const RSVP_LABEL: Record<Rsvp, string> = { ATTENDING: 'Attending', NOT_ATTENDING: 'Not attending', TENTATIVE: 'Maybe' };

export const errText = (err: any, fallback: string) => {
  const m = err?.response?.data?.message;
  const details = err?.response?.data?.errors;
  if (Array.isArray(details) && details.length) return details.map((d: any) => d.message).join(' ');
  return (Array.isArray(m) ? m.join(' ') : m) || fallback;
};

/** A datetime-local value as an Indian-time instant, and back. */
export const toInstant = (local: string) => (local ? `${local}:00+05:30` : '');
export const toLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value;
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
};

export const fmtWhen = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '—';
export const fmtShort = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—';
export const fmtDate = (d: string | null) =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export function MeetingStatusBadge({ status, scheduledAt }: { status: MeetingStatus; scheduledAt: string }) {
  if (status === 'DRAFT') return <Badge variant="warning">Draft (not announced)</Badge>;
  if (status === 'CANCELLED') return <Badge variant="danger">Cancelled</Badge>;
  if (status === 'HELD') return <Badge variant="muted">Held</Badge>;
  return new Date(scheduledAt).getTime() < Date.now() ? <Badge variant="info">Under way</Badge> : <Badge variant="success">Upcoming</Badge>;
}

export function Notice({ notice }: { notice: { type: 'success' | 'error'; text: string } | null }) {
  if (!notice) return null;
  return (
    <div
      role="status"
      className={`rounded-md border px-3 py-2 text-sm ${
        notice.type === 'success'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
          : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300'
      }`}
    >
      {notice.text}
    </div>
  );
}
