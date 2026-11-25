'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, History, Loader2, Pause, Pencil, Play, Plus, RefreshCw, SkipForward, Trash2 } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { PaidFromSelect, bankLabel, useBankAccounts } from './paid-from-select';
import { Textarea } from '@/components/ui/textarea';

type AmountType = 'FIXED' | 'VARIABLE' | 'STAFF_SALARY';
type Frequency = 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY';

interface Template {
  id: string;
  name: string;
  expenseHead: string;
  vendorName: string | null;
  staffId: string | null;
  staffName: string | null;
  staffSalary: string | null;
  amountType: AmountType;
  amount: string;
  frequency: Frequency;
  dayOfMonth: number;
  startDate: string;
  endDate: string | null;
  nextRunDate: string;
  lastRunDate: string | null;
  autoPost: boolean;
  postAs: 'PAID' | 'UNPAID';
  paymentMode: 'BANK' | 'CASH';
  bankAccountId: string | null;
  isActive: boolean;
  notes: string | null;
}

interface Draft {
  id: string;
  recurringExpenseId: string;
  name: string | null;
  description: string | null;
  periodKey: string;
  expenseHead: string | null;
  paymentMode: 'BANK' | 'CASH' | null;
  amount: string;
  date: string;
  amountType: AmountType | null;
  postAs: 'PAID' | 'UNPAID' | null;
  bankAccountId: string | null;
  vendorName: string | null;
}

interface HistoryRow {
  id: string;
  periodKey: string;
  amount: string;
  date: string;
  status: string;
  billNumber: string | null;
  voucherNumber: string | null;
}

interface StaffMember {
  id: string;
  name: string;
  role: string;
  salary: string | null;
}

type TemplateForm = Omit<Template, 'id' | 'staffName' | 'staffSalary' | 'nextRunDate' | 'lastRunDate' | 'amount'> & { amount: string };

const FREQUENCY_LABEL: Record<Frequency, string> = {
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  HALF_YEARLY: 'Half-yearly',
  YEARLY: 'Yearly',
};

const AMOUNT_TYPE_LABEL: Record<AmountType, string> = {
  FIXED: 'Fixed amount',
  VARIABLE: 'Changes every time (enter actual bill)',
  STAFF_SALARY: "Staff member's salary",
};

const rupees = (v: number | string) => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const fmtDate = (d: string | null) =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const ordinal = (n: number) => `${n}${['th', 'st', 'nd', 'rd'][n % 10 > 3 || Math.floor((n % 100) / 10) === 1 ? 0 : n % 10]}`;
const today = () => new Date().toLocaleDateString('en-CA');
const errText = (err: any, fallback: string) => {
  const d = err?.response?.data;
  const first = Array.isArray(d?.errors) ? d.errors[0]?.message : null;
  return first || (typeof d?.message === 'string' ? d.message : null) || fallback;
};

function emptyForm(): TemplateForm {
  const t = today();
  return {
    name: '',
    expenseHead: '',
    vendorName: '',
    staffId: null,
    amountType: 'FIXED',
    amount: '',
    frequency: 'MONTHLY',
    dayOfMonth: 1,
    startDate: `${t.slice(0, 7)}-01`,
    endDate: null,
    autoPost: false,
    postAs: 'UNPAID',
    paymentMode: 'BANK',
    bankAccountId: null,
    isActive: true,
    notes: '',
  };
}

function toForm(t: Template): TemplateForm {
  return {
    name: t.name,
    expenseHead: t.expenseHead,
    vendorName: t.vendorName || '',
    staffId: t.staffId,
    amountType: t.amountType,
    amount: String(Number(t.amount) || ''),
    frequency: t.frequency,
    dayOfMonth: t.dayOfMonth,
    startDate: t.startDate,
    endDate: t.endDate,
    autoPost: t.autoPost,
    postAs: t.postAs,
    paymentMode: t.paymentMode,
    bankAccountId: t.bankAccountId,
    isActive: t.isActive,
    notes: t.notes || '',
  };
}

/** "cash in hand" or the bank account's name, for the posting summary. */
function paidFromName(v: { paymentMode: 'BANK' | 'CASH'; bankAccountId: string | null }, accounts: ReturnType<typeof useBankAccounts>) {
  if (v.paymentMode === 'CASH') return 'cash in hand';
  const a = accounts.find((x) => x.id === v.bankAccountId) || accounts[0];
  return a ? bankLabel(a).replace(' (default)', '') : 'the bank account';
}

function describeAmount(t: Template) {
  if (t.amountType === 'STAFF_SALARY') return `${rupees(t.staffSalary || t.amount)} (salary of ${t.staffName || 'staff'})`;
  if (t.amountType === 'VARIABLE') return Number(t.amount) > 0 ? `About ${rupees(t.amount)}` : 'Actual bill';
  return rupees(t.amount);
}

/** Recurring expenses: templates that draft an expense every period, plus the review list of drafts. */
export function RecurringExpensesPanel({ canWrite, onPosted }: { canWrite: boolean; onPosted?: () => void }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [heads, setHeads] = useState<{ id: string; name: string; code: string | null }[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [editing, setEditing] = useState<{ id?: string; form: TemplateForm } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [posting, setPosting] = useState<{ draft: Draft; amount: string; date: string; billNumber: string; status: 'PAID' | 'UNPAID'; paymentMode: 'BANK' | 'CASH'; bankAccountId: string | null } | null>(null);
  const [postError, setPostError] = useState<string | null>(null);
  const bankAccounts = useBankAccounts();
  const [history, setHistory] = useState<{ template: Template; rows: HistoryRow[] | null } | null>(null);

  const load = useCallback(async () => {
    try {
      const [t, d, h] = await Promise.all([
        apiClient.get('/accounting/recurring-expenses'),
        apiClient.get('/accounting/recurring-expenses/drafts'),
        apiClient.get('/accounting/recurring-expenses/expense-heads'),
      ]);
      setTemplates(t.data?.data || []);
      setDrafts(d.data?.data || []);
      setHeads(h.data?.data || []);
    } catch (err) {
      setNotice({ type: 'error', text: errText(err, 'Could not load recurring expenses.') });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    apiClient
      .get('/staff')
      .then((r) => setStaffList(r.data?.data || []))
      .catch(() => setStaffList([]));
  }, [load]);

  const summary = (r: { drafted?: number; posted?: number }) => {
    const parts: string[] = [];
    const review = (r.drafted || 0) - (r.posted || 0);
    if (review > 0) parts.push(`${review} drafted for review`);
    if (r.posted) parts.push(`${r.posted} posted automatically`);
    return parts.length ? ` ${parts.join(', ')}.` : '';
  };

  const saveTemplate = async () => {
    if (!editing) return;
    const f = editing.form;
    setBusy(true);
    setFormError(null);
    const body = {
      ...f,
      vendorName: f.vendorName?.trim() || null,
      staffId: f.amountType === 'STAFF_SALARY' ? f.staffId : f.staffId || null,
      amount: Number(f.amount) || 0,
      endDate: f.endDate || null,
      notes: f.notes?.trim() || null,
      autoPost: f.amountType === 'VARIABLE' ? false : f.autoPost,
    };
    try {
      const res = editing.id
        ? await apiClient.patch(`/accounting/recurring-expenses/${editing.id}`, body)
        : await apiClient.post('/accounting/recurring-expenses', body);
      const r = res.data?.data || {};
      setNotice({ type: 'success', text: `${f.name} saved.${summary(r)}` });
      setEditing(null);
      await load();
      if (r.posted) onPosted?.();
    } catch (err) {
      setFormError(errText(err, 'Could not save.'));
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (t: Template) => {
    setBusy(true);
    try {
      const res = await apiClient.patch(`/accounting/recurring-expenses/${t.id}`, {
        ...toForm(t),
        amount: Number(t.amount),
        vendorName: t.vendorName || null,
        notes: t.notes || null,
        isActive: !t.isActive,
      });
      setNotice({
        type: 'success',
        text: t.isActive ? `${t.name} paused. No new drafts until you resume it.` : `${t.name} resumed from this month.${summary(res.data?.data || {})}`,
      });
      await load();
    } catch (err) {
      setNotice({ type: 'error', text: errText(err, 'Could not change it.') });
    } finally {
      setBusy(false);
    }
  };

  const removeTemplate = async (t: Template) => {
    if (!window.confirm(`Delete "${t.name}"? Drafts waiting for review are removed too. Expenses already posted stay in the books.`)) return;
    setBusy(true);
    try {
      await apiClient.delete(`/accounting/recurring-expenses/${t.id}`);
      setNotice({ type: 'success', text: `${t.name} deleted.` });
      await load();
    } catch (err) {
      setNotice({ type: 'error', text: errText(err, 'Could not delete it.') });
    } finally {
      setBusy(false);
    }
  };

  const runNow = async () => {
    setBusy(true);
    try {
      const res = await apiClient.post('/accounting/recurring-expenses/run');
      const r = res.data?.data || {};
      setNotice({ type: 'success', text: r.drafted ? `Done.${summary(r)}` : 'Nothing is due yet.' });
      await load();
      if (r.posted) onPosted?.();
    } catch (err) {
      setNotice({ type: 'error', text: errText(err, 'Could not check for due expenses.') });
    } finally {
      setBusy(false);
    }
  };

  const openPost = (d: Draft) => {
    setPostError(null);
    setPosting({
      draft: d,
      amount: Number(d.amount) > 0 ? String(Number(d.amount)) : '',
      date: d.date,
      billNumber: '',
      status: d.postAs || 'UNPAID',
      paymentMode: d.paymentMode || 'BANK',
      bankAccountId: d.paymentMode === 'CASH' ? null : d.bankAccountId,
    });
  };

  const confirmPost = async () => {
    if (!posting) return;
    setBusy(true);
    setPostError(null);
    try {
      const res = await apiClient.post(`/accounting/recurring-expenses/drafts/${posting.draft.id}/post`, {
        amount: Number(posting.amount),
        date: posting.date,
        billNumber: posting.billNumber.trim() || null,
        status: posting.status,
        paymentMode: posting.paymentMode,
        bankAccountId: posting.paymentMode === 'BANK' ? posting.bankAccountId : null,
      });
      setNotice({ type: 'success', text: `${posting.draft.description || 'Expense'} posted (${res.data?.data?.voucherNumber}).` });
      setPosting(null);
      await load();
      onPosted?.();
    } catch (err) {
      setPostError(errText(err, 'Could not post this expense.'));
    } finally {
      setBusy(false);
    }
  };

  const skip = async (d: Draft) => {
    if (!window.confirm(`Skip "${d.description}"? Nothing is posted for this period and it will not be drafted again.`)) return;
    setBusy(true);
    try {
      await apiClient.post(`/accounting/recurring-expenses/drafts/${d.id}/skip`);
      setNotice({ type: 'success', text: `${d.description} skipped.` });
      await load();
    } catch (err) {
      setNotice({ type: 'error', text: errText(err, 'Could not skip it.') });
    } finally {
      setBusy(false);
    }
  };

  const openHistory = async (t: Template) => {
    setHistory({ template: t, rows: null });
    try {
      const res = await apiClient.get(`/accounting/recurring-expenses/${t.id}/history`);
      setHistory({ template: t, rows: res.data?.data || [] });
    } catch {
      setHistory({ template: t, rows: [] });
    }
  };

  const setForm = (patch: Partial<TemplateForm>) => setEditing((e) => (e ? { ...e, form: { ...e.form, ...patch } } : e));
  const f = editing?.form;
  const headOptions = f && f.expenseHead && !heads.some((h) => h.name === f.expenseHead) ? [...heads, { id: 'custom', name: f.expenseHead, code: null }] : heads;

  if (loading) {
    return (
      <div className="flex justify-center py-12 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {notice && (
        <p
          role="status"
          className={`rounded-md border px-3 py-2 text-sm ${
            notice.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300'
              : 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300'
          }`}
        >
          {notice.text}
        </p>
      )}

      {/* Drafts to review */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>To review</CardTitle>
              <CardDescription className="mt-1">
                Drafted from your recurring expenses. Check the amount against the actual bill, then post it to the books, or skip it for that period.
              </CardDescription>
            </div>
            {canWrite && (
              <Button variant="outline" size="sm" onClick={runNow} disabled={busy}>
                <RefreshCw /> Check for due expenses
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {drafts.length === 0 ? (
            <p className="py-4 text-sm text-slate-500">Nothing to review. New drafts appear here on each expense's date.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-3 py-2 text-left">Expense</th>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Expense head</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {drafts.map((d) => (
                    <tr key={d.id} className="align-top">
                      <td className="px-3 py-2.5">
                        <div className="text-slate-900 dark:text-slate-100">{d.description}</div>
                        {d.vendorName && <div className="mt-0.5 text-xs text-slate-500">{d.vendorName}</div>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-600 dark:text-slate-300">{fmtDate(d.date)}</td>
                      <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">{d.expenseHead}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right">
                        {d.amountType === 'VARIABLE' ? (
                          <span className="text-amber-700 dark:text-amber-400">{Number(d.amount) > 0 ? `Est. ${rupees(d.amount)}` : 'Enter bill'}</span>
                        ) : (
                          <span className="text-slate-900 dark:text-slate-100">{rupees(d.amount)}</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right">
                        {canWrite && (
                          <div className="flex justify-end gap-1.5">
                            <Button size="sm" onClick={() => openPost(d)} disabled={busy}>
                              <CheckCircle2 /> Review &amp; post
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => skip(d)} disabled={busy}>
                              <SkipForward /> Skip
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Templates */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Recurring expenses</CardTitle>
              <CardDescription className="mt-1">
                Salaries, electricity, lift maintenance and other regular payments. Each one creates an expense every period.
              </CardDescription>
            </div>
            {canWrite && (
              <Button
                size="sm"
                onClick={() => {
                  setFormError(null);
                  setEditing({ form: emptyForm() });
                }}
              >
                <Plus /> New recurring expense
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <p className="py-4 text-sm text-slate-500">
              None yet. Add things you pay regularly, such as the watchman's salary or the electricity bill.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-3 py-2 text-left">Name</th>
                    <th className="px-3 py-2 text-left">Amount</th>
                    <th className="px-3 py-2 text-left">Schedule</th>
                    <th className="px-3 py-2 text-left">Next</th>
                    <th className="px-3 py-2 text-left">Posting</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {templates.map((t) => {
                    const ended = !!t.endDate && t.nextRunDate > t.endDate;
                    return (
                      <tr key={t.id} className={`align-top ${t.isActive ? '' : 'opacity-60'}`}>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-900 dark:text-slate-100">{t.name}</span>
                            {!t.isActive && <Badge variant="muted">Paused</Badge>}
                            {t.isActive && ended && <Badge variant="muted">Ended</Badge>}
                          </div>
                          <div className="mt-0.5 text-xs text-slate-500">
                            {t.expenseHead}
                            {t.vendorName ? ` · ${t.vendorName}` : ''}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">{describeAmount(t)}</td>
                        <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">
                          {FREQUENCY_LABEL[t.frequency]}, on the {ordinal(t.dayOfMonth)}
                          {t.endDate && <div className="text-xs text-slate-500">until {fmtDate(t.endDate)}</div>}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-slate-600 dark:text-slate-300">
                          {t.isActive && !ended ? fmtDate(t.nextRunDate) : '—'}
                        </td>
                        <td className="px-3 py-2.5">
                          {t.autoPost ? (
                            <Badge variant="info">Automatic · {t.postAs === 'PAID' ? 'paid' : 'payable'}</Badge>
                          ) : (
                            <Badge variant="outline">Review first</Badge>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right">
                          <Button variant="ghost" size="icon-sm" aria-label={`History of ${t.name}`} onClick={() => openHistory(t)}>
                            <History />
                          </Button>
                          {canWrite && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Edit ${t.name}`}
                                onClick={() => {
                                  setFormError(null);
                                  setEditing({ id: t.id, form: toForm(t) });
                                }}
                              >
                                <Pencil />
                              </Button>
                              <Button variant="ghost" size="icon-sm" aria-label={`${t.isActive ? 'Pause' : 'Resume'} ${t.name}`} onClick={() => toggleActive(t)} disabled={busy}>
                                {t.isActive ? <Pause /> : <Play />}
                              </Button>
                              <Button variant="ghost" size="icon-sm" aria-label={`Delete ${t.name}`} onClick={() => removeTemplate(t)} disabled={busy} className="text-red-600">
                                <Trash2 />
                              </Button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Template editor */}
      <Dialog open={!!editing} onOpenChange={(open: boolean) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? `Edit ${editing.form.name || 'recurring expense'}` : 'New recurring expense'}</DialogTitle>
            <DialogDescription>Changes apply to future periods. Expenses already posted are not changed.</DialogDescription>
          </DialogHeader>
          {f && (
            <div className="grid max-h-[65vh] gap-4 overflow-y-auto pr-1 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="re-name">Name</Label>
                <Input id="re-name" value={f.name} onChange={(e) => setForm({ name: e.target.value })} placeholder="e.g. Watchman salary, MSEB electricity" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="re-head">Expense head</Label>
                <NativeSelect id="re-head" value={f.expenseHead} onChange={(e) => setForm({ expenseHead: e.target.value })}>
                  <option value="">Choose…</option>
                  {headOptions.map((h) => (
                    <option key={h.id} value={h.name}>
                      {h.code ? `${h.code} · ` : ''}
                      {h.name}
                    </option>
                  ))}
                  <option value="__new__">+ New expense head…</option>
                </NativeSelect>
                {f.expenseHead === '__new__' && (
                  <Input
                    autoFocus
                    className="mt-1.5"
                    placeholder="e.g. Staff Salaries"
                    onBlur={(e) => setForm({ expenseHead: e.target.value.trim() })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') setForm({ expenseHead: (e.target as HTMLInputElement).value.trim() });
                    }}
                  />
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="re-vendor">Paid to (optional)</Label>
                <Input id="re-vendor" value={f.vendorName || ''} onChange={(e) => setForm({ vendorName: e.target.value })} placeholder="Vendor or agency" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="re-amount-type">Amount</Label>
                <NativeSelect
                  id="re-amount-type"
                  value={f.amountType}
                  onChange={(e) => {
                    const amountType = e.target.value as AmountType;
                    setForm({ amountType, autoPost: amountType === 'VARIABLE' ? false : f.autoPost });
                  }}
                >
                  {(Object.keys(AMOUNT_TYPE_LABEL) as AmountType[]).map((k) => (
                    <option key={k} value={k}>
                      {AMOUNT_TYPE_LABEL[k]}
                    </option>
                  ))}
                </NativeSelect>
              </div>

              {f.amountType === 'STAFF_SALARY' ? (
                <div className="space-y-1.5">
                  <Label htmlFor="re-staff">Staff member</Label>
                  <NativeSelect id="re-staff" value={f.staffId || ''} onChange={(e) => setForm({ staffId: e.target.value || null })}>
                    <option value="">Choose…</option>
                    {staffList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.role.toLowerCase()}) · {rupees(s.salary || 0)}
                      </option>
                    ))}
                  </NativeSelect>
                  <p className="text-xs text-slate-500">Uses their salary from Staff each time, so a raise is picked up automatically.</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="re-amount">{f.amountType === 'VARIABLE' ? 'Typical amount (optional)' : 'Amount (₹)'}</Label>
                  <Input id="re-amount" type="number" min="0" step="0.01" value={f.amount} onChange={(e) => setForm({ amount: e.target.value })} />
                  {f.amountType === 'VARIABLE' && <p className="text-xs text-slate-500">Shown as an estimate; you enter the actual bill when posting.</p>}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="re-frequency">Repeats</Label>
                <NativeSelect id="re-frequency" value={f.frequency} onChange={(e) => setForm({ frequency: e.target.value as Frequency })}>
                  {(Object.keys(FREQUENCY_LABEL) as Frequency[]).map((k) => (
                    <option key={k} value={k}>
                      {FREQUENCY_LABEL[k]}
                    </option>
                  ))}
                </NativeSelect>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="re-day">On day of the month</Label>
                <NativeSelect id="re-day" value={f.dayOfMonth} onChange={(e) => setForm({ dayOfMonth: Number(e.target.value) })}>
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>
                      {ordinal(d)}
                    </option>
                  ))}
                </NativeSelect>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="re-start">Starts</Label>
                <Input id="re-start" type="date" value={f.startDate} onChange={(e) => setForm({ startDate: e.target.value })} />
                <p className="text-xs text-slate-500">The first expense is in this month. Past months are drafted at once (up to 12).</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="re-end">Ends (optional)</Label>
                <Input id="re-end" type="date" value={f.endDate || ''} onChange={(e) => setForm({ endDate: e.target.value || null })} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="re-post-as">When posted, record as</Label>
                <NativeSelect id="re-post-as" value={f.postAs} onChange={(e) => setForm({ postAs: e.target.value as 'PAID' | 'UNPAID' })}>
                  <option value="UNPAID">Payable (to be paid)</option>
                  <option value="PAID">Paid</option>
                </NativeSelect>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="re-mode">Paid from</Label>
                <PaidFromSelect
                  id="re-mode"
                  accounts={bankAccounts}
                  value={{ paymentMode: f.paymentMode, bankAccountId: f.bankAccountId }}
                  onChange={(v) => setForm(v)}
                />
              </div>

              <label className={`flex items-start gap-2.5 rounded-md border p-3 sm:col-span-2 ${f.amountType === 'VARIABLE' ? 'opacity-60' : ''}`}>
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={f.autoPost}
                  disabled={f.amountType === 'VARIABLE'}
                  onChange={(e) => setForm({ autoPost: e.target.checked })}
                />
                <span className="text-sm">
                  <span className="font-medium text-slate-900 dark:text-slate-100">Post automatically</span>
                  <span className="block text-xs text-slate-500">
                    {f.amountType === 'VARIABLE'
                      ? 'Not available when the amount changes every time; those always wait for review.'
                      : 'Skip the review step and post to the books on the expense date. Leave off to check each one first.'}
                  </span>
                </span>
              </label>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="re-notes">Notes (optional)</Label>
                <Textarea id="re-notes" rows={2} value={f.notes || ''} onChange={(e) => setForm({ notes: e.target.value })} />
              </div>
            </div>
          )}
          {formError && <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={saveTemplate} disabled={busy || !f?.name.trim() || !f?.expenseHead || f?.expenseHead === '__new__'}>
              {busy && <Loader2 className="animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Post a draft */}
      <Dialog open={!!posting} onOpenChange={(open: boolean) => !open && setPosting(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Post {posting?.draft.description}</DialogTitle>
            <DialogDescription>
              Debits {posting?.draft.expenseHead}; credits{' '}
              {posting?.status === 'PAID' ? paidFromName(posting, bankAccounts) : 'vendor payables'}.
            </DialogDescription>
          </DialogHeader>
          {posting && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="post-amount">Actual amount (₹)</Label>
                <Input
                  id="post-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  autoFocus
                  value={posting.amount}
                  onChange={(e) => setPosting({ ...posting, amount: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="post-date">Date</Label>
                <Input id="post-date" type="date" value={posting.date} onChange={(e) => setPosting({ ...posting, date: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="post-bill">Bill / reference no. (optional)</Label>
                <Input id="post-bill" value={posting.billNumber} onChange={(e) => setPosting({ ...posting, billNumber: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="post-status">Record as</Label>
                <NativeSelect id="post-status" value={posting.status} onChange={(e) => setPosting({ ...posting, status: e.target.value as 'PAID' | 'UNPAID' })}>
                  <option value="UNPAID">Payable (to be paid)</option>
                  <option value="PAID">Paid</option>
                </NativeSelect>
              </div>
              {posting.status === 'PAID' && (
                <div className="space-y-1.5">
                  <Label htmlFor="post-mode">Paid from</Label>
                  <PaidFromSelect
                    id="post-mode"
                    accounts={bankAccounts}
                    value={{ paymentMode: posting.paymentMode, bankAccountId: posting.bankAccountId }}
                    onChange={(v) => setPosting({ ...posting, ...v })}
                  />
                </div>
              )}
            </div>
          )}
          {postError && <p className="text-sm text-red-600 dark:text-red-400">{postError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPosting(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={confirmPost} disabled={busy || !(Number(posting?.amount) > 0)}>
              {busy && <Loader2 className="animate-spin" />} Post {posting && Number(posting.amount) > 0 ? rupees(posting.amount) : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History */}
      <Dialog open={!!history} onOpenChange={(open: boolean) => !open && setHistory(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{history?.template.name}</DialogTitle>
            <DialogDescription>Last 36 periods.</DialogDescription>
          </DialogHeader>
          {!history?.rows ? (
            <div className="flex justify-center py-6 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : history.rows.length === 0 ? (
            <p className="text-sm text-slate-500">Nothing yet.</p>
          ) : (
            <div className="max-h-[55vh] overflow-y-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-3 py-2 text-left">Period</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Voucher</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {history.rows.map((r) => (
                    <tr key={r.id}>
                      <td className="px-3 py-2">{fmtDate(r.date)}</td>
                      <td className="px-3 py-2">
                        <Badge variant={r.status === 'PAID' ? 'success' : r.status === 'UNPAID' ? 'warning' : 'muted'}>
                          {{ PAID: 'Paid', UNPAID: 'Payable', DRAFT: 'To review', SKIPPED: 'Skipped' }[r.status] || r.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-500">{r.voucherNumber || '—'}</td>
                      <td className="px-3 py-2 text-right">{rupees(r.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
