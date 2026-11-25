'use client';

import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { AlertTriangle, ArrowLeft, CheckCircle2, Eye, FileSpreadsheet, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';

type GenerationType = 'SINGLE' | 'PER_MONTH';

interface PlannedBill {
  start: string;
  end: string;
  months: number;
  subtotal: number;
  gstRate: number | null;
  gstAmount: number;
  amount: number;
}

interface PreviewRow {
  flatId: string;
  flatNumber: string;
  flatType: string;
  wingName: string;
  buildingName: string;
  ownerName: string | null;
  category: { id: string; name: string; usage: 'RESIDENTIAL' | 'COMMERCIAL' };
  rateApplied: number | null;
  monthly: { lines: { head: string; amount: number }[]; total: number };
  bills: PlannedBill[];
  subtotal: number;
  gstAmount: number;
  total: number;
  conflicts: { billNumber: string; start: string; end: string; status: string }[];
}

interface Preview {
  rows: PreviewRow[];
  summary: { flats: number; conflictingFlats: number; billableFlats: number; billsToCreate: number; totalAmount: number; gstAmount: number };
}

interface GeneratedRow {
  flatNumber: string;
  flatType: string;
  wingName: string;
  buildingName: string;
  floorNumber: number;
  ownerName: string | null;
  category: string;
  usage: string;
  rateApplied: number | null;
  billNumbers: string[];
  months: number;
  charges: Record<string, number>;
  subtotal: number;
  gstAmount: number;
  total: number;
}

const rupees = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Months of the billing period as { year, month(0-11) }. */
function monthsInRange(start: string, end: string) {
  if (!start || !end || start > end) return [];
  const [sy, sm] = start.split('-').map(Number);
  const [ey, em] = end.split('-').map(Number);
  const list: { year: number; month: number }[] = [];
  for (let i = sy * 12 + sm - 1; i <= ey * 12 + em - 1 && list.length < 24; i++) {
    list.push({ year: Math.floor(i / 12), month: i % 12 });
  }
  return list;
}

const pad = (n: number) => String(n).padStart(2, '0');

function apiError(err: any): string {
  const data = err?.response?.data;
  const first = Array.isArray(data?.errors) && data.errors[0]?.message;
  return first || data?.message || err?.message || 'Something went wrong.';
}

/** Bill generation: choose period and penalty start, preview, then generate (and optionally download the list). */
export function GenerateBillsPanel({
  graceDays,
  onGenerated,
}: {
  graceDays: number;
  onGenerated: (summary: string) => void;
}) {
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [generationType, setGenerationType] = useState<GenerationType>('SINGLE');
  const [usage, setUsage] = useState<'ALL' | 'RESIDENTIAL' | 'COMMERCIAL'>('ALL');

  const [penaltyMode, setPenaltyMode] = useState<'default' | 'custom'>('default');
  const [penaltyMonthIndex, setPenaltyMonthIndex] = useState(0);
  const [penaltyDay, setPenaltyDay] = useState(10);

  const [downloadAfter, setDownloadAfter] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState<'xlsx' | 'csv'>('xlsx');

  const [preview, setPreview] = useState<Preview | null>(null);
  const [skipConflicts, setSkipConflicts] = useState(false);
  const [busy, setBusy] = useState<'preview' | 'generate' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const months = useMemo(() => monthsInRange(periodStart, periodEnd), [periodStart, periodEnd]);
  const penaltyFromDate = useMemo(() => {
    if (penaltyMode !== 'custom' || months.length === 0) return null;
    const m = months[Math.min(penaltyMonthIndex, months.length - 1)];
    const lastDay = new Date(m.year, m.month + 1, 0).getDate();
    return `${m.year}-${pad(m.month + 1)}-${pad(Math.min(Math.max(1, penaltyDay), lastDay))}`;
  }, [penaltyMode, months, penaltyMonthIndex, penaltyDay]);

  const payload = () => ({
    periodStart,
    periodEnd,
    dueDate,
    generationType,
    penaltyFromDate,
    skipConflicts,
    usage,
  });

  const runPreview = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!periodStart || !periodEnd || !dueDate) {
      setError('Fill in the billing period and due date.');
      return;
    }
    setBusy('preview');
    try {
      const res = await apiClient.post('/maintenance/generate/preview', payload());
      setPreview(res.data.data);
      setSkipConflicts(false);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(null);
    }
  };

  const download = (rows: GeneratedRow[]) => {
    // Every charge head that appears in this run becomes its own column.
    const heads = Array.from(new Set(rows.flatMap((r) => Object.keys(r.charges))));
    const sheetRows = rows.map((r) => ({
      Building: r.buildingName,
      Wing: r.wingName,
      Floor: r.floorNumber,
      Flat: r.flatNumber,
      'Flat type': r.flatType,
      Category: r.category,
      Use: r.usage === 'COMMERCIAL' ? 'Commercial' : 'Residential',
      Owner: r.ownerName || '',
      'Period start': periodStart,
      'Period end': periodEnd,
      Months: r.months,
      'Rate applied': r.rateApplied ?? '',
      ...Object.fromEntries(heads.map((h) => [h, r.charges[h] ?? 0])),
      Subtotal: r.subtotal,
      GST: r.gstAmount,
      'Total amount': r.total,
      'Due date': dueDate,
      'Penalty from': penaltyFromDate || 'Due date + grace period',
      'Bill numbers': r.billNumbers.join(', '),
    }));
    const sheet = XLSX.utils.json_to_sheet(sheetRows);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Bills');
    const name = `maintenance-bills_${periodStart}_to_${periodEnd}.${downloadFormat}`;
    XLSX.writeFile(book, name, { bookType: downloadFormat });
  };

  const runGenerate = async () => {
    setError(null);
    setBusy('generate');
    try {
      const res = await apiClient.post('/maintenance/generate', payload());
      const data = res.data.data;
      if (downloadAfter) download(data.rows);
      const skipped = data.skippedFlats?.length ? ` ${data.skippedFlats.length} already-billed flat(s) skipped.` : '';
      onGenerated(`Generated ${data.billsCreated} bill(s) for ${data.count} flat(s).${skipped}`);
      setPreview(null);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(null);
    }
  };

  const conflicting = preview?.rows.filter((r) => r.conflicts.length > 0) ?? [];
  const willBill = preview ? (skipConflicts || conflicting.length === 0 ? preview.rows.filter((r) => r.conflicts.length === 0) : []) : [];
  const canGenerate = !!preview && willBill.length > 0;

  // ── Step 2: preview ────────────────────────────────────────────────────────
  if (preview) {
    return (
      <Card className="w-full">
        <CardHeader>
          <div>
            <CardTitle>Preview bills</CardTitle>
            <CardDescription className="mt-1">
              {usage === 'ALL' ? 'All units' : usage === 'COMMERCIAL' ? 'Commercial units' : 'Residential units'} · {periodStart} to {periodEnd} · {generationType === 'SINGLE' ? 'one combined bill per flat' : 'one bill per month'} · due {dueDate} · penalty{' '}
              {penaltyFromDate ? `from ${penaltyFromDate}` : 'after due date + grace (society or category rules)'}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => setPreview(null)}>
            <ArrowLeft /> Edit
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              ['Flats', preview.summary.flats],
              ['Already billed', preview.summary.conflictingFlats],
              ['Bills to create', willBill.reduce((n, r) => n + r.bills.length, 0)],
              ['Total amount', rupees(willBill.reduce((n, r) => n + r.total, 0))],
              ['of which GST', rupees(willBill.reduce((n, r) => n + r.gstAmount, 0))],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-md border px-3 py-2">
                <div className="text-xs text-slate-500">{label}</div>
                <div className="text-lg tabular-nums text-slate-900 dark:text-slate-100">{value}</div>
              </div>
            ))}
          </div>

          {conflicting.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
              <p className="flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4" />
                {conflicting.length} flat(s) are already billed for part of this period
              </p>
              <p className="mt-1 text-amber-800 dark:text-amber-300">
                Bills are never created twice for the same month. Skip these flats to bill the rest, or change the period.
              </p>
              <label className="mt-2 flex items-center gap-2">
                <input type="checkbox" checked={skipConflicts} onChange={(e) => setSkipConflicts(e.target.checked)} />
                Skip the {conflicting.length} already-billed flat(s) and bill the other {preview.rows.length - conflicting.length}
              </label>
            </div>
          )}

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-3 py-2 text-left">Flat</th>
                  <th className="px-3 py-2 text-left">Owner</th>
                  <th className="px-3 py-2 text-left">Category</th>
                  <th className="px-3 py-2 text-left">Bills</th>
                  <th className="px-3 py-2 text-right">Monthly</th>
                  <th className="px-3 py-2 text-right">GST</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => {
                  const blocked = r.conflicts.length > 0;
                  return (
                    <tr key={r.flatId} className={cn(blocked && 'bg-amber-50/50 dark:bg-amber-950/20')}>
                      <td className="whitespace-nowrap px-3 py-2">
                        {r.flatNumber} <span className="text-slate-500">· {r.wingName}</span>
                      </td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{r.ownerName || '—'}</td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <div className="text-slate-900 dark:text-slate-100">{r.category.name}</div>
                        <div className="text-xs text-slate-500">
                          {r.category.usage === 'COMMERCIAL' ? 'Commercial' : 'Residential'}
                          {r.rateApplied !== null ? ` · rate ${rupees(r.rateApplied)}` : ''}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                        {r.bills.map((b) => (
                          <div key={b.start} className="whitespace-nowrap tabular-nums">
                            {b.start} → {b.end} <span className="text-slate-400">({b.months} mo · {rupees(b.amount)})</span>
                          </div>
                        ))}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums" title={r.monthly.lines.map((l) => `${l.head}: ${rupees(l.amount)}`).join('\n')}>
                        {rupees(r.monthly.total)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.gstAmount > 0 ? rupees(r.gstAmount) : '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{rupees(r.total)}</td>
                      <td className="px-3 py-2">
                        {blocked ? (
                          <Badge variant="warning" title={r.conflicts.map((c) => `${c.billNumber} (${c.start} → ${c.end}, ${c.status})`).join('\n')}>
                            Already billed: {r.conflicts.map((c) => c.billNumber).join(', ')}
                          </Badge>
                        ) : (
                          <Badge variant="success">Will be billed</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              {downloadAfter ? `${downloadFormat === 'xlsx' ? 'An Excel' : 'A CSV'} list (one row per flat) downloads after generating.` : 'No file will be downloaded.'}
            </p>
            <Button onClick={runGenerate} disabled={!canGenerate || busy !== null}>
              {busy === 'generate' ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
              {canGenerate ? `Generate ${willBill.reduce((n, r) => n + r.bills.length, 0)} bill(s)` : 'Nothing to generate'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Step 1: settings ───────────────────────────────────────────────────────
  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <div>
          <CardTitle>Generate maintenance bills</CardTitle>
          <CardDescription className="mt-1">Choose the period, check the preview, then generate. Months already billed are never billed again.</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={runPreview} className="space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="gen-start">Period start</Label>
              <Input id="gen-start" type="date" required value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gen-end">Period end</Label>
              <Input id="gen-end" type="date" required value={periodEnd} min={periodStart || undefined} onChange={(e) => setPeriodEnd(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gen-due">Due date</Label>
              <Input id="gen-due" type="date" required value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm text-slate-500">Units to bill</legend>
            <div className="flex flex-wrap gap-4 text-sm">
              {([
                ['ALL', 'All units'],
                ['RESIDENTIAL', 'Residential only'],
                ['COMMERCIAL', 'Commercial only'],
              ] as const).map(([value, label]) => (
                <label key={value} className="flex items-center gap-2">
                  <input type="radio" name="gen-usage" checked={usage === value} onChange={() => setUsage(value)} />
                  {label}
                </label>
              ))}
            </div>
            <p className="text-xs text-slate-500">Rates, GST and late fees come from each unit&apos;s billing category.</p>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm text-slate-500">Bills per flat</legend>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" name="gen-type" checked={generationType === 'SINGLE'} onChange={() => setGenerationType('SINGLE')} />
                One combined bill{months.length > 1 ? ` (${months.length} months)` : ''}
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="gen-type" checked={generationType === 'PER_MONTH'} onChange={() => setGenerationType('PER_MONTH')} />
                One bill per month
              </label>
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm text-slate-500">Late fee starts</legend>
            <div className="flex flex-col gap-2 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" name="gen-penalty" checked={penaltyMode === 'default'} onChange={() => setPenaltyMode('default')} />
                After the due date + grace period (society setting{graceDays ? `, ${graceDays} day(s)` : ''}, or the category&apos;s own rules)
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="gen-penalty" checked={penaltyMode === 'custom'} onChange={() => setPenaltyMode('custom')} disabled={months.length === 0} />
                From a chosen date in the period {months.length === 0 && <span className="text-slate-400">(pick the period first)</span>}
              </label>
            </div>
            {penaltyMode === 'custom' && months.length > 0 && (
              <div className="flex flex-wrap items-end gap-3 pl-6">
                <div className="space-y-1.5">
                  <Label htmlFor="gen-pen-month">Month</Label>
                  <NativeSelect id="gen-pen-month" className="w-56" value={penaltyMonthIndex} onChange={(e) => setPenaltyMonthIndex(Number(e.target.value))}>
                    {months.map((m, i) => (
                      <option key={i} value={i}>
                        {['1st', '2nd', '3rd'][i] || `${i + 1}th`} month · {MONTH_NAMES[m.month]} {m.year}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gen-pen-day">Day</Label>
                  <Input id="gen-pen-day" type="number" min={1} max={31} className="w-20" value={penaltyDay} onChange={(e) => setPenaltyDay(Number(e.target.value) || 1)} />
                </div>
                <p className="pb-2 text-sm text-slate-600 dark:text-slate-300">
                  Late fee from <span className="font-medium text-slate-900 dark:text-slate-100">{penaltyFromDate}</span>
                  {generationType === 'PER_MONTH' && ' for every bill in this run'}
                </p>
              </div>
            )}
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm text-slate-500">After generating</legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={downloadAfter} onChange={(e) => setDownloadAfter(e.target.checked)} />
              <FileSpreadsheet className="h-4 w-4 text-slate-500" />
              Download the bill list (one row per flat)
            </label>
            {downloadAfter && (
              <div className="flex gap-4 pl-6 text-sm">
                <label className="flex items-center gap-2">
                  <input type="radio" name="gen-format" checked={downloadFormat === 'xlsx'} onChange={() => setDownloadFormat('xlsx')} /> Excel (.xlsx)
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="gen-format" checked={downloadFormat === 'csv'} onChange={() => setDownloadFormat('csv')} /> CSV
                </label>
              </div>
            )}
          </fieldset>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex justify-end border-t pt-4">
            <Button type="submit" disabled={busy !== null}>
              {busy === 'preview' ? <Loader2 className="animate-spin" /> : <Eye />}
              Preview bills
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
