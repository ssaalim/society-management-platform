'use client';

import { Badge } from '@/components/ui/badge';

export interface Visit {
  id: string;
  flatId: string;
  flatLabel: string;
  name: string;
  mobile: string;
  vehicleNumber: string | null;
  type: string;
  typeLabel: string;
  company: string | null;
  purpose: string | null;
  headcount: number;
  entryTime: string;
  enteredAt: string | null;
  exitTime: string | null;
  status: 'PENDING' | 'APPROVED' | 'DENIED' | 'INSIDE' | 'EXITED';
  approvalMethod: string | null;
  decidedByName: string | null;
  decisionNote: string | null;
  noResponse: boolean;
}

export const VISITOR_TYPES = [
  { value: 'GUEST', label: 'Guest' },
  { value: 'DELIVERY', label: 'Delivery' },
  { value: 'CAB', label: 'Cab' },
  { value: 'SERVICE', label: 'Service / repair' },
];

export const HELP_CATEGORIES = [
  { value: 'MAID', label: 'Maid' },
  { value: 'COOK', label: 'Cook' },
  { value: 'DRIVER', label: 'Driver' },
  { value: 'NANNY', label: 'Nanny' },
  { value: 'CLEANER', label: 'Cleaner' },
  { value: 'OTHER', label: 'Other' },
];
export const helpLabel = (c: string) => HELP_CATEGORIES.find((h) => h.value === c)?.label || c;

export const METHOD_LABEL: Record<string, string> = {
  RESIDENT_APP: 'allowed in the app',
  GUARD_CALL: 'confirmed by phone',
  PASS: 'guest pass',
  DAILY_HELP: 'daily help',
};

export const errText = (err: any, fallback: string) => {
  const m = err?.response?.data?.message;
  const details = err?.response?.data?.errors;
  if (Array.isArray(details) && details.length) return details.map((d: any) => d.message).join(' ');
  return (Array.isArray(m) ? m.join(' ') : m) || fallback;
};

export const toInstant = (local: string) => (local ? `${local}:00+05:30` : '');
export const localNow = (plusMinutes = 0) => {
  const d = new Date(Date.now() + plusMinutes * 60_000);
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value;
  return `${g('year')}-${g('month')}-${g('day')}T${g('hour')}:${g('minute')}`;
};
export const todayIST = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

export const fmtTime = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' }) : '—');
export const fmtDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—';
export const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h} h ago` : fmtDateTime(iso);
};

export function VisitStatus({ v }: { v: Pick<Visit, 'status' | 'noResponse'> }) {
  if (v.status === 'PENDING') return v.noResponse ? <Badge variant="muted">No response</Badge> : <Badge variant="warning">Waiting for you</Badge>;
  if (v.status === 'APPROVED') return <Badge variant="info">Allowed</Badge>;
  if (v.status === 'DENIED') return <Badge variant="danger">Denied</Badge>;
  if (v.status === 'INSIDE') return <Badge variant="success">Inside</Badge>;
  return <Badge variant="muted">Left</Badge>;
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
