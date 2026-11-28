'use client';

import { Badge } from '@/components/ui/badge';

export type Method = 'EQUAL' | 'BY_AREA' | 'BY_FLAT_TYPE' | 'VOLUNTARY';

export interface FundSummary {
  id: string;
  name: string;
  description: string | null;
  targetAmount: string;
  method: Method;
  methodLabel: string;
  perFlatAmount: string | null;
  ratePerSqft: string | null;
  typeAmounts: Record<string, number> | null;
  dueDate: string | null;
  accountingMode?: 'CASH' | 'ACCRUAL';
  pendingClaims?: number;
  status: 'DRAFT' | 'ACTIVE' | 'CLOSED';
  collected: number;
  spent: number;
  balance: number;
  demanded: number;
  waived: number;
  shareCount: number;
  paidCount: number;
  percent: number;
  myDue?: number;
  myShares?: number;
}

export const METHODS: { value: Method; label: string; hint: string }[] = [
  { value: 'EQUAL', label: 'Equal per flat', hint: 'Every flat pays the same amount.' },
  { value: 'BY_AREA', label: 'By area', hint: 'A rate per sq ft of each flat.' },
  { value: 'BY_FLAT_TYPE', label: 'By flat type', hint: 'A fixed amount for each flat type (2BHK, shop, …).' },
  { value: 'VOLUNTARY', label: 'Voluntary', hint: 'No fixed shares; anyone contributes what they like.' },
];

export const rupees = (v: number | string) => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
export const fmtDate = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const todayIST = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

export const errText = (err: any, fallback: string) => {
  const m = err?.response?.data?.message;
  const details = err?.response?.data?.errors;
  if (Array.isArray(details) && details.length) return details.map((d: any) => d.message).join(' ');
  return (Array.isArray(m) ? m.join(' ') : m) || fallback;
};

export function FundStatus({ status }: { status: FundSummary['status'] }) {
  if (status === 'DRAFT') return <Badge variant="warning">Draft</Badge>;
  if (status === 'CLOSED') return <Badge variant="muted">Closed</Badge>;
  return <Badge variant="success">Collecting</Badge>;
}

export function ShareStatus({ status }: { status: string }) {
  if (status === 'PAID') return <Badge variant="success">Paid</Badge>;
  if (status === 'PARTIAL') return <Badge variant="info">Part paid</Badge>;
  if (status === 'WAIVED') return <Badge variant="muted">Waived</Badge>;
  return <Badge variant="warning">Unpaid</Badge>;
}

/** Collected against the target, with what has been spent. */
export function Progress({ f }: { f: Pick<FundSummary, 'collected' | 'targetAmount' | 'spent' | 'percent'> }) {
  const target = Number(f.targetAmount);
  const spentPct = target > 0 ? Math.min(100, (f.spent / target) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div
        className="relative h-2.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={f.percent}
        aria-label={`${f.percent}% of the target collected`}
      >
        <div className="absolute inset-y-0 left-0 rounded-full bg-emerald-500" style={{ width: `${f.percent}%` }} />
        {f.spent > 0 && <div className="absolute inset-y-0 left-0 rounded-full bg-amber-500/80" style={{ width: `${spentPct}%` }} />}
      </div>
      <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
        <span>
          <span className="font-medium text-foreground">{rupees(f.collected)}</span> of {rupees(target)} ({f.percent}%)
        </span>
        {f.spent > 0 && <span>{rupees(f.spent)} spent</span>}
      </div>
    </div>
  );
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
