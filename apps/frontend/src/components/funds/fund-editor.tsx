'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { FundSummary, METHODS, Method, errText, rupees } from './fund-utils';

/** Create a fund, or change it (only wording, target and due date once shares are issued). */
export function FundEditor({ fund, onClose, onSaved }: { fund?: FundSummary; onClose: () => void; onSaved: (id: string) => void }) {
  const issued = !!fund && fund.status !== 'DRAFT';
  const [d, setD] = useState({
    name: fund?.name || '',
    description: fund?.description || '',
    targetAmount: fund ? String(Number(fund.targetAmount)) : '',
    method: (fund?.method || 'EQUAL') as Method,
    perFlatAmount: fund?.perFlatAmount ? String(Number(fund.perFlatAmount)) : '',
    ratePerSqft: fund?.ratePerSqft ? String(Number(fund.ratePerSqft)) : '',
    typeAmounts: Object.fromEntries(Object.entries(fund?.typeAmounts || {}).map(([k, v]) => [k, String(v)])) as Record<string, string>,
    dueDate: fund?.dueDate || '',
    accountingMode: (fund?.accountingMode || 'CASH') as 'CASH' | 'ACCRUAL',
  });
  const [flatInfo, setFlatInfo] = useState<{ count: number; area: number; types: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<typeof d>) => setD((x) => ({ ...x, ...patch }));

  // Flats, to suggest a per-flat amount or rate that reaches the target.
  useEffect(() => {
    apiClient
      .get('/flats')
      .then((res) => {
        const list = res.data?.data?.list ?? res.data?.data ?? [];
        setFlatInfo({
          count: list.length,
          area: list.reduce((n: number, f: any) => n + Number(f.sqftArea || 0), 0),
          types: Array.from(new Set<string>(list.map((f: any) => f.flatType).filter(Boolean))).sort(),
        });
      })
      .catch(() => setFlatInfo(null));
  }, []);

  const target = Number(d.targetAmount) || 0;
  const suggestion = useMemo(() => {
    if (!flatInfo || !target) return null;
    if (d.method === 'EQUAL' && flatInfo.count) return { label: `${rupees(Math.ceil(target / flatInfo.count))} per flat reaches the target (${flatInfo.count} flats)`, value: String(Math.ceil(target / flatInfo.count)), key: 'perFlatAmount' as const };
    if (d.method === 'BY_AREA' && flatInfo.area) {
      const rate = Math.ceil((target / flatInfo.area) * 100) / 100;
      return { label: `${rupees(rate)} per sq ft reaches the target (${flatInfo.area.toLocaleString('en-IN')} sq ft in all)`, value: String(rate), key: 'ratePerSqft' as const };
    }
    return null;
  }, [flatInfo, target, d.method]);

  const save = async () => {
    setBusy(true);
    setError(null);
    const body = {
      name: d.name,
      description: d.description.trim() || null,
      targetAmount: target,
      method: d.method,
      perFlatAmount: d.perFlatAmount ? Number(d.perFlatAmount) : null,
      ratePerSqft: d.ratePerSqft ? Number(d.ratePerSqft) : null,
      typeAmounts: d.method === 'BY_FLAT_TYPE' ? Object.fromEntries(Object.entries(d.typeAmounts).filter(([, v]) => Number(v) > 0).map(([k, v]) => [k, Number(v)])) : null,
      dueDate: d.dueDate || null,
      accountingMode: d.accountingMode,
    };
    try {
      const res = fund ? await apiClient.patch(`/funds/${fund.id}`, body) : await apiClient.post('/funds', body);
      onSaved(res.data.data.id);
    } catch (err) {
      setError(errText(err, 'Could not save.'));
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{fund ? `Edit ${fund.name}` : 'New fund collection'}</DialogTitle>
          <DialogDescription>
            {issued ? 'Shares are issued, so only the wording, target and due date can change.' : 'Saved as a draft. You review each flat’s share before issuing.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="fd-name">Name</Label>
            <Input id="fd-name" value={d.name} placeholder="e.g. Generator, Building painting" onChange={(e) => set({ name: e.target.value })} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="fd-desc">Purpose (shown to members)</Label>
            <Textarea id="fd-desc" rows={2} value={d.description} onChange={(e) => set({ description: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fd-target">Target (₹)</Label>
            <Input id="fd-target" type="number" min="1" value={d.targetAmount} onChange={(e) => set({ targetAmount: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fd-due">Pay by (optional)</Label>
            <Input id="fd-due" type="date" value={d.dueDate} onChange={(e) => set({ dueDate: e.target.value })} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="fd-method">How shares are worked out</Label>
            <NativeSelect id="fd-method" value={d.method} disabled={issued} onChange={(e) => set({ method: e.target.value as Method })}>
              {METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </NativeSelect>
            <p className="text-xs text-muted-foreground">{METHODS.find((m) => m.value === d.method)?.hint}</p>
          </div>
          {!issued && d.method === 'EQUAL' && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="fd-per">Amount per flat (₹)</Label>
              <Input id="fd-per" type="number" min="1" value={d.perFlatAmount} onChange={(e) => set({ perFlatAmount: e.target.value })} />
            </div>
          )}
          {!issued && d.method === 'BY_AREA' && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="fd-rate">Rate per sq ft (₹)</Label>
              <Input id="fd-rate" type="number" min="0" step="0.01" value={d.ratePerSqft} onChange={(e) => set({ ratePerSqft: e.target.value })} />
            </div>
          )}
          {!issued && suggestion && (
            <p className="text-xs text-muted-foreground sm:col-span-2">
              {suggestion.label}.{' '}
              <button type="button" className="text-brand-600 hover:underline" onClick={() => set({ [suggestion.key]: suggestion.value } as any)}>
                Use it
              </button>
            </p>
          )}
          {!issued && d.method === 'BY_FLAT_TYPE' && (
            <div className="space-y-2 sm:col-span-2">
              <Label>Amount per flat type (₹)</Label>
              {(flatInfo?.types || Object.keys(d.typeAmounts)).map((t) => (
                <div key={t} className="flex items-center gap-2">
                  <span className="w-40 text-sm">{t}</span>
                  <Input
                    aria-label={`Amount for ${t}`}
                    type="number"
                    min="0"
                    value={d.typeAmounts[t] || ''}
                    placeholder="0 = not charged"
                    onChange={(e) => set({ typeAmounts: { ...d.typeAmounts, [t]: e.target.value } })}
                  />
                </div>
              ))}
            </div>
          )}
          {d.method !== 'VOLUNTARY' && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="fd-basis">In the books</Label>
              <NativeSelect id="fd-basis" value={d.accountingMode} disabled={issued} onChange={(e) => set({ accountingMode: e.target.value as 'CASH' | 'ACCRUAL' })}>
                <option value="CASH">When money is received (cash basis)</option>
                <option value="ACCRUAL">When shares are issued (as receivables)</option>
              </NativeSelect>
              <p className="text-xs text-muted-foreground">
                {d.accountingMode === 'ACCRUAL'
                  ? 'Issued shares go on the balance sheet as "Fund Contributions Receivable" until paid or waived. Ask your auditor if unsure.'
                  : 'Only money actually received is booked. Unpaid shares show in the fund’s “Still due” list.'}
              </p>
            </div>
          )}
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy || !d.name.trim() || !target}>
            {busy && <Loader2 className="animate-spin" />} {fund ? 'Save' : 'Create draft'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
