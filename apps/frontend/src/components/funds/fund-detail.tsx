'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard, Download, FileText, IndianRupee, Loader2, Lock, Pencil, Printer, Receipt, Send, Trash2, Undo2, Unlock, Wallet } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { PageHeader } from '@/components/ui/page-header';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PaidFromSelect, bankLabel, useBankAccounts } from '@/components/accounting/paid-from-select';
import { useAuth } from '@/app/providers/auth-context';
import { FundEditor } from './fund-editor';
import { DemandDocument, ReceiptDocument } from './fund-documents';
import { ApproveDialog, Claim, ClaimDialog, ClaimsCard, ReasonDialog, payOnline } from './fund-payments';
import { FundStatus, FundSummary, Notice, Progress, ShareStatus, errText, fmtDate, rupees, todayIST } from './fund-utils';

interface Share {
  id: string;
  flatId: string;
  flatLabel: string;
  flatType: string;
  invoiceNumber: string;
  amount: string;
  paidAmount: string;
  due: number;
  status: string;
  waivedReason: string | null;
  pendingClaimed: number;
  mine: boolean;
}

interface Payment {
  id: string;
  flatLabel: string | null;
  payerName: string | null;
  amount: string;
  paidAt: string;
  paymentMode: string;
  reference: string | null;
  receiptNumber: string;
  source: 'OFFICE' | 'CLAIM' | 'ONLINE';
  reversedAt: string | null;
  reverseReason: string | null;
}

interface Expense {
  id: string;
  description: string;
  vendorName: string | null;
  billNumber: string | null;
  amount: string;
  spentAt: string;
  paymentMode: string;
  assetName: string | null;
}

type Detail = FundSummary & { canManage: boolean; canApprove: boolean; onlinePayments: boolean; shares: Share[]; payments: Payment[]; expenses: Expense[]; claims: Claim[] };

export function FundDetail({ slug, fundId }: { slug: string; fundId: string }) {
  const router = useRouter();
  const [f, setF] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [paying, setPaying] = useState<{ share?: Share } | null>(null);
  const [waiving, setWaiving] = useState<Share | null>(null);
  const [spending, setSpending] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'DUE' | 'PAID'>('ALL');
  const { user } = useAuth();
  const [claiming, setClaiming] = useState<{ share?: Share } | null>(null);
  const [approving, setApproving] = useState<Claim | null>(null);
  const [rejecting, setRejecting] = useState<Claim | null>(null);
  const [reversing, setReversing] = useState<Payment | null>(null);
  const [printDemand, setPrintDemand] = useState<Share | null>(null);
  const [printReceipt, setPrintReceipt] = useState<Payment | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get(`/funds/${fundId}`);
      setF(res.data.data);
    } catch (err) {
      setError(errText(err, 'Could not load this fund.'));
    }
  }, [fundId]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (fn: () => Promise<any>, text: string | ((d: any) => string)) => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fn();
      if (res?.data?.data?.id === fundId) setF(res.data.data);
      else await load();
      setNotice({ type: 'success', text: typeof text === 'function' ? text(res?.data?.data) : text });
      return true;
    } catch (err) {
      setNotice({ type: 'error', text: errText(err, 'That did not work.') });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const startOnline = async (share: Share | null, amount: number | null) => {
    setBusy(true);
    setNotice(null);
    try {
      const d = await payOnline(fundId, { shareId: share?.id || null, amount }, { name: user?.name || undefined, email: user?.email });
      if (d) {
        setF(d);
        setNotice({ type: 'success', text: 'Payment received. Thank you! Your receipt is under “Your payments”.' });
      }
    } catch (err: any) {
      setNotice({ type: 'error', text: errText(err, err?.message || 'The payment did not go through.') });
    } finally {
      setBusy(false);
    }
  };

  if (error) return <Notice notice={{ type: 'error', text: error }} />;
  if (!f)
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );

  const shares = f.shares.filter((s) => (filter === 'DUE' ? ['UNPAID', 'PARTIAL'].includes(s.status) : filter === 'PAID' ? s.status === 'PAID' : true));
  const outstanding = f.shares.filter((s) => ['UNPAID', 'PARTIAL'].includes(s.status)).reduce((n, s) => n + s.due, 0);

  const exportDefaulters = () => {
    const rows = [['Flat', 'Type', 'Demand no.', 'Share', 'Paid', 'Due', 'Status']];
    for (const s of f.shares) rows.push([s.flatLabel, s.flatType, s.invoiceNumber, s.amount, s.paidAmount, String(s.due), s.status]);
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${f.name.replace(/\W+/g, '-')}-shares.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        crumbs={[{ label: 'Fund collection', href: `/${slug}/funds` }]}
        title={f.name}
        actions={
          f.canManage && (
            <div className="flex flex-wrap gap-2">
              {f.status === 'ACTIVE' && (
                <>
                  <Button size="sm" disabled={busy} onClick={() => setPaying({})}>
                    <IndianRupee /> Record payment
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy || f.balance <= 0} onClick={() => setSpending(true)}>
                    <Wallet /> Record spending
                  </Button>
                </>
              )}
              <Button size="sm" variant="outline" disabled={busy} onClick={() => setEditing(true)}>
                <Pencil /> Edit
              </Button>
              {f.status === 'ACTIVE' && (
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => window.confirm('Close this fund? No more payments can be recorded until you reopen it.') && act(() => apiClient.post(`/funds/${f.id}/close`), 'Fund closed.')}>
                  <Lock /> Close
                </Button>
              )}
              {f.status === 'CLOSED' && (
                <Button size="sm" variant="outline" disabled={busy} onClick={() => act(() => apiClient.post(`/funds/${f.id}/reopen`), 'Fund reopened.')}>
                  <Unlock /> Reopen
                </Button>
              )}
              {f.status === 'DRAFT' && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-600"
                  disabled={busy}
                  onClick={async () => {
                    if (!window.confirm('Delete this draft?')) return;
                    try {
                      await apiClient.delete(`/funds/${f.id}`);
                      router.push(`/${slug}/funds`);
                    } catch (err) {
                      setNotice({ type: 'error', text: errText(err, 'Could not delete.') });
                    }
                  }}
                >
                  <Trash2 /> Delete
                </Button>
              )}
            </div>
          )
        }
      />
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <FundStatus status={f.status} />
        <Badge variant="outline">{f.methodLabel}</Badge>
        {f.canManage && f.accountingMode === 'ACCRUAL' && <Badge variant="outline">Accrual basis</Badge>}
        {f.dueDate && <span>Pay by {fmtDate(f.dueDate)}</span>}
      </div>
      {f.description && <p className="text-sm">{f.description}</p>}
      <Notice notice={notice} />

      {f.status === 'DRAFT' ? (
        f.canManage ? (
          <IssuePanel fund={f} busy={busy} onIssue={(list) => act(() => apiClient.post(`/funds/${f.id}/issue`, { shares: list }), f.method === 'VOLUNTARY' ? 'Collection opened. Members have been told.' : `${list.length} demands issued. Each flat has been told its share.`)} />
        ) : null
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Collected" value={rupees(f.collected)} />
            <Stat label="Spent" value={rupees(f.spent)} />
            <Stat label="Balance in fund" value={rupees(f.balance)} />
            {f.method !== 'VOLUNTARY' && f.canManage ? <Stat label="Still due" value={rupees(outstanding)} /> : <Stat label="Target" value={rupees(f.targetAmount)} />}
          </div>
          <Card>
            <CardContent className="p-4">
              <Progress f={f} />
            </CardContent>
          </Card>

          <ClaimsCard
            claims={f.claims}
            canApprove={f.canApprove}
            myUserId={user?.id || null}
            busy={busy}
            onApprove={setApproving}
            onReject={setRejecting}
          />

          {f.method === 'VOLUNTARY' && f.status === 'ACTIVE' && !f.canManage && (
            <Card>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <p className="text-sm text-muted-foreground">Want to contribute? Pay at the office{f.onlinePayments ? ', pay online' : ''}, or tell us after paying by UPI or transfer.</p>
                <div className="flex gap-2">
                  {f.onlinePayments && (
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => {
                        const v = Number(window.prompt('How much would you like to give (₹)?', '1000'));
                        if (v >= 1) startOnline(null, v);
                      }}
                    >
                      <CreditCard /> Pay online
                    </Button>
                  )}
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => setClaiming({})}>
                    I&apos;ve paid
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {f.method !== 'VOLUNTARY' && (
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
                <div>
                  <CardTitle className="text-base">{f.canManage ? 'Shares' : 'Your share'}</CardTitle>
                  {f.canManage && (
                    <CardDescription>
                      {f.paidCount} of {f.shareCount} paid in full{f.waived > 0 ? ` · ${rupees(f.waived)} waived` : ''}
                    </CardDescription>
                  )}
                </div>
                {f.canManage && (
                  <div className="flex gap-2">
                    <NativeSelect aria-label="Show" className="w-auto" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
                      <option value="ALL">All flats</option>
                      <option value="DUE">Still due</option>
                      <option value="PAID">Paid</option>
                    </NativeSelect>
                    <Button size="sm" variant="outline" onClick={exportDefaulters}>
                      <Download /> CSV
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="p-0">
                {shares.length === 0 ? (
                  <p className="p-6 pt-0 text-sm text-muted-foreground">{f.canManage ? 'Nothing here.' : 'Your flat has no share in this fund.'}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Flat</TableHead>
                          <TableHead>Demand no.</TableHead>
                          <TableHead className="text-right">Share</TableHead>
                          <TableHead className="text-right">Paid</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {shares.map((s) => (
                          <TableRow key={s.id}>
                            <TableCell>
                              <div>{s.flatLabel}</div>
                              <div className="text-xs text-muted-foreground">{s.flatType}</div>
                            </TableCell>
                            <TableCell className="text-sm">{s.invoiceNumber}</TableCell>
                            <TableCell className="text-right tabular-nums">{rupees(s.amount)}</TableCell>
                            <TableCell className="text-right tabular-nums">{rupees(s.paidAmount)}</TableCell>
                            <TableCell>
                              <ShareStatus status={s.status} />
                              {s.waivedReason && <div className="text-xs text-muted-foreground">{s.waivedReason}</div>}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-right">
                              <div className="flex items-center justify-end gap-1">
                                {['UNPAID', 'PARTIAL'].includes(s.status) && f.status === 'ACTIVE' && f.canManage && (
                                  <>
                                    <Button size="sm" variant="outline" className="h-7" disabled={busy} onClick={() => setPaying({ share: s })}>
                                      Pay {rupees(s.due)}
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-7" disabled={busy} onClick={() => setWaiving(s)}>
                                      Waive
                                    </Button>
                                  </>
                                )}
                                {['UNPAID', 'PARTIAL'].includes(s.status) && f.status === 'ACTIVE' && s.mine && !f.canManage && (
                                  s.due - s.pendingClaimed > 0 ? (
                                    <>
                                      {f.onlinePayments && (
                                        <Button size="sm" className="h-7" disabled={busy} onClick={() => startOnline(s, null)}>
                                          <CreditCard /> Pay {rupees(s.due)} online
                                        </Button>
                                      )}
                                      <Button size="sm" variant="outline" className="h-7" disabled={busy} onClick={() => setClaiming({ share: s })}>
                                        I&apos;ve paid
                                      </Button>
                                    </>
                                  ) : (
                                    <Badge variant="warning">Payment waiting for approval</Badge>
                                  )
                                )}
                                <Button size="sm" variant="ghost" className="h-7" title="Print the demand" aria-label={`Print demand ${s.invoiceNumber}`} onClick={() => setPrintDemand(s)}>
                                  <FileText />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {!f.canManage && f.shares.some((s) => s.due > 0) && (
                  <p className="px-4 pb-4 text-sm text-muted-foreground">
                    Pay at the society office{f.onlinePayments ? ' or online' : ''}. Paid by UPI or bank transfer? Tap “I’ve paid” with the reference number so the office can
                    confirm it. This is separate from your maintenance bill.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Receipt className="h-4 w-4" /> {f.canManage ? 'Payments received' : 'Your payments'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {f.payments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">None yet.</p>
                ) : (
                  f.payments.map((p) => (
                    <div key={p.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm ${p.reversedAt ? 'opacity-60' : ''}`}>
                      <span>
                        <span className="font-medium">{p.flatLabel || p.payerName}</span>
                        {p.flatLabel && p.payerName && <span className="text-muted-foreground"> · {p.payerName}</span>}
                        {p.source === 'ONLINE' && <Badge variant="info" className="ml-2">Online</Badge>}
                        {p.reversedAt && <Badge variant="destructive" className="ml-2">Reversed</Badge>}
                        <span className="block text-xs text-muted-foreground">
                          {fmtDate(p.paidAt)} · {p.paymentMode}
                          {p.reference ? ` ${p.reference}` : ''} · {p.receiptNumber}
                        </span>
                        {p.reverseReason && <span className="block text-xs text-red-600 dark:text-red-400">Reversed: {p.reverseReason}</span>}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className={`tabular-nums ${p.reversedAt ? 'line-through' : ''}`}>{rupees(p.amount)}</span>
                        <Button size="sm" variant="ghost" className="h-7 px-2" title="Print receipt" aria-label={`Print receipt ${p.receiptNumber}`} onClick={() => setPrintReceipt(p)}>
                          <Printer />
                        </Button>
                        {f.canManage && !p.reversedAt && (
                          <Button size="sm" variant="ghost" className="h-7 px-2" title="Reverse this payment" aria-label={`Reverse ${p.receiptNumber}`} disabled={busy} onClick={() => setReversing(p)}>
                            <Undo2 />
                          </Button>
                        )}
                      </span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Wallet className="h-4 w-4" /> Spent from the fund
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {f.expenses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nothing spent yet.</p>
                ) : (
                  f.expenses.map((e) => (
                    <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                      <span>
                        <span className="font-medium">{e.description}</span>
                        <span className="block text-xs text-muted-foreground">
                          {fmtDate(e.spentAt)}
                          {e.vendorName ? ` · ${e.vendorName}` : ''}
                          {e.billNumber ? ` · bill ${e.billNumber}` : ''}
                          {e.assetName ? ` · fixed asset: ${e.assetName}` : ''}
                        </span>
                      </span>
                      <span className="tabular-nums">{rupees(e.amount)}</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {editing && (
        <FundEditor
          fund={f}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            load();
            setNotice({ type: 'success', text: 'Fund updated.' });
          }}
        />
      )}
      {paying && (
        <PaymentDialog
          fund={f}
          share={paying.share}
          onClose={() => setPaying(null)}
          onSave={async (body) => {
            const okd = await act(() => apiClient.post(`/funds/${f.id}/payments`, body), (d) => `Payment recorded. Receipt ${d?.lastReceipt}.`);
            if (okd) setPaying(null);
          }}
        />
      )}
      {waiving && (
        <WaiveDialog
          share={waiving}
          onClose={() => setWaiving(null)}
          onSave={async (reason) => {
            const okd = await act(() => apiClient.patch(`/funds/shares/${waiving.id}/waive`, { reason }), `${waiving.flatLabel}'s remaining share waived.`);
            if (okd) setWaiving(null);
          }}
        />
      )}
      {claiming && (
        <ClaimDialog
          title={claiming.share ? `I've paid for ${claiming.share.flatLabel}` : `I've contributed to ${f.name}`}
          maxAmount={claiming.share ? claiming.share.due - claiming.share.pendingClaimed : null}
          defaultAmount={claiming.share ? claiming.share.due - claiming.share.pendingClaimed : null}
          onClose={() => setClaiming(null)}
          onSave={async (body) => {
            const okd = await act(
              () => apiClient.post(`/funds/${f.id}/claims`, { ...body, shareId: claiming.share?.id || null, flatId: claiming.share?.flatId || null }),
              'Sent. The office will confirm it after checking the bank statement.',
            );
            if (okd) setClaiming(null);
          }}
        />
      )}
      {approving && (
        <ApproveDialog
          claim={approving}
          onClose={() => setApproving(null)}
          onSave={async (body) => {
            const okd = await act(() => apiClient.post(`/funds/claims/${approving.id}/approve`, body), 'Approved and recorded. The flat has been sent the receipt.');
            if (okd) setApproving(null);
          }}
        />
      )}
      {rejecting && (
        <ReasonDialog
          title={`Reject ${rupees(rejecting.amount)} from ${rejecting.flatLabel || 'a member'}?`}
          description="The amount stays due and the resident is told why."
          confirm="Reject"
          placeholder="e.g. Not found in the bank statement"
          onClose={() => setRejecting(null)}
          onSave={async (reason) => {
            const okd = await act(() => apiClient.post(`/funds/claims/${rejecting.id}/reject`, { reason }), 'Rejected. The resident has been told.');
            if (okd) setRejecting(null);
          }}
        />
      )}
      {reversing && (
        <ReasonDialog
          title={`Reverse receipt ${reversing.receiptNumber}?`}
          description={`${rupees(reversing.amount)} comes out of the fund and the books, and the amount is due again from ${reversing.flatLabel || reversing.payerName || 'the payer'}. The receipt stays on record, marked reversed.`}
          confirm="Reverse payment"
          placeholder="e.g. Cheque bounced"
          onClose={() => setReversing(null)}
          onSave={async (reason) => {
            const okd = await act(() => apiClient.post(`/funds/payments/${reversing.id}/reverse`, { reason }), `Receipt ${reversing.receiptNumber} reversed.`);
            if (okd) setReversing(null);
          }}
        />
      )}
      {printDemand && <DemandDocument fund={f} share={printDemand} onClose={() => setPrintDemand(null)} />}
      {printReceipt && <ReceiptDocument fund={f} payment={printReceipt} onClose={() => setPrintReceipt(null)} />}
      {spending && (
        <SpendDialog
          balance={f.balance}
          onClose={() => setSpending(false)}
          onSave={async (body) => {
            const okd = await act(() => apiClient.post(`/funds/${f.id}/expenses`, body), 'Spending recorded.');
            if (okd) setSpending(false);
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ issue

function IssuePanel({ fund, busy, onIssue }: { fund: Detail; busy: boolean; onIssue: (list: { flatId: string; amount: number }[]) => void }) {
  const [rows, setRows] = useState<{ flatId: string; flatLabel: string; flatType: string; area: number; amount: string; include: boolean }[] | null>(null);
  const [info, setInfo] = useState<{ target: number; untyped: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get(`/funds/${fund.id}/preview`)
      .then((res) => {
        const d = res.data.data;
        setInfo({ target: d.target, untyped: d.untyped });
        setRows(d.shares.map((s: any) => ({ ...s, amount: String(s.amount), include: s.amount > 0 })));
      })
      .catch((err) => setError(errText(err, 'Could not work out the shares.')));
  }, [fund.id, fund.method, fund.perFlatAmount, fund.ratePerSqft, fund.typeAmounts]);

  const total = useMemo(() => (rows || []).filter((r) => r.include).reduce((n, r) => n + (Number(r.amount) || 0), 0), [rows]);

  if (fund.method === 'VOLUNTARY') {
    return (
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm text-muted-foreground">Voluntary: no shares. Open the collection to start recording contributions; every member is told.</p>
          <Button disabled={busy} onClick={() => onIssue([])}>
            <Send /> Open collection
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Review each flat’s share</CardTitle>
        <CardDescription>Change an amount or untick a flat before issuing. Each flat gets its own demand, separate from maintenance.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && <Notice notice={{ type: 'error', text: error }} />}
        {info?.untyped.length ? (
          <p className="text-sm text-amber-700 dark:text-amber-400">No amount set for: {info.untyped.join(', ')}. Those flats are unticked.</p>
        ) : null}
        {!rows ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Flat</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Area</TableHead>
                  <TableHead className="w-36 text-right">Share (₹)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={r.flatId} className={r.include ? '' : 'opacity-50'}>
                    <TableCell>
                      <input
                        type="checkbox"
                        aria-label={`Include ${r.flatLabel}`}
                        checked={r.include}
                        onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, include: e.target.checked } : x)))}
                      />
                    </TableCell>
                    <TableCell>{r.flatLabel}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.flatType}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{r.area.toLocaleString('en-IN')} sq ft</TableCell>
                    <TableCell>
                      <Input
                        aria-label={`Share for ${r.flatLabel}`}
                        className="h-8 text-right tabular-nums"
                        type="number"
                        min="0"
                        value={r.amount}
                        disabled={!r.include}
                        onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
          <div className="text-sm">
            Total <span className="font-semibold tabular-nums">{rupees(total)}</span> for {(rows || []).filter((r) => r.include).length} flats
            {info && (
              <span className={total < info.target ? ' text-amber-700 dark:text-amber-400' : ' text-muted-foreground'}>
                {' '}
                · target {rupees(info.target)}
                {total < info.target ? ` (${rupees(info.target - total)} short)` : ''}
              </span>
            )}
          </div>
          <Button
            disabled={busy || !rows || total <= 0}
            onClick={() =>
              window.confirm('Issue these shares? Each flat is told its share and the amounts can no longer be changed.') &&
              onIssue((rows || []).filter((r) => r.include && Number(r.amount) > 0).map((r) => ({ flatId: r.flatId, amount: Number(r.amount) })))
            }
          >
            <Send /> Issue demands
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------------------------------------------ dialogs

function PaymentDialog({ fund, share, onClose, onSave }: { fund: Detail; share?: Share; onClose: () => void; onSave: (body: any) => void }) {
  const accounts = useBankAccounts();
  const open = fund.shares.filter((s) => ['UNPAID', 'PARTIAL'].includes(s.status));
  const [shareId, setShareId] = useState(share?.id || '');
  const [flats, setFlats] = useState<{ id: string; label: string }[]>([]);
  const [d, setD] = useState({ flatId: '', payerName: '', amount: share ? String(share.due) : '', paidAt: todayIST(), paymentMode: 'UPI', bankAccountId: '', reference: '' });
  const voluntary = fund.method === 'VOLUNTARY';
  const picked = fund.shares.find((s) => s.id === shareId);

  useEffect(() => {
    if (!voluntary) return;
    apiClient
      .get('/flats')
      .then((res) => {
        const list = res.data?.data?.list ?? res.data?.data ?? [];
        setFlats(list.map((f: any) => ({ id: f.id, label: f.wingName ? `${f.wingName}-${f.number}` : f.number })).sort((a: any, b: any) => a.label.localeCompare(b.label, 'en', { numeric: true })));
      })
      .catch(() => setFlats([]));
  }, [voluntary]);

  return (
    <Dialog open onOpenChange={(o: boolean) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>Goes into the {fund.name} fund, with a receipt.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          {!voluntary ? (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="fp-share">Flat</Label>
              <NativeSelect
                id="fp-share"
                value={shareId}
                onChange={(e) => {
                  setShareId(e.target.value);
                  const s = fund.shares.find((x) => x.id === e.target.value);
                  if (s) setD({ ...d, amount: String(s.due) });
                }}
              >
                <option value="">Choose…</option>
                {open.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.flatLabel}: {rupees(s.due)} due
                  </option>
                ))}
              </NativeSelect>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="fp-flat">Flat (optional)</Label>
                <NativeSelect id="fp-flat" value={d.flatId} onChange={(e) => setD({ ...d, flatId: e.target.value })}>
                  <option value="">Not a flat</option>
                  {flats.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fp-payer">Name {d.flatId ? '(optional)' : ''}</Label>
                <Input id="fp-payer" value={d.payerName} placeholder="e.g. a sponsor" onChange={(e) => setD({ ...d, payerName: e.target.value })} />
              </div>
            </>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="fp-amount">Amount (₹)</Label>
            <Input id="fp-amount" type="number" min="1" value={d.amount} onChange={(e) => setD({ ...d, amount: e.target.value })} />
            {picked && <p className="text-xs text-muted-foreground">{rupees(picked.due)} due on this share.</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fp-date">Received on</Label>
            <Input id="fp-date" type="date" value={d.paidAt} onChange={(e) => setD({ ...d, paidAt: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fp-mode">Mode</Label>
            <NativeSelect id="fp-mode" value={d.paymentMode} onChange={(e) => setD({ ...d, paymentMode: e.target.value })}>
              {['UPI', 'NEFT', 'CHEQUE', 'CARD', 'CASH'].map((m) => (
                <option key={m} value={m}>
                  {m === 'CASH' ? 'Cash' : m}
                </option>
              ))}
            </NativeSelect>
          </div>
          {d.paymentMode !== 'CASH' && accounts.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="fp-bank">Deposited in</Label>
              <NativeSelect id="fp-bank" value={d.bankAccountId || accounts[0].id} onChange={(e) => setD({ ...d, bankAccountId: e.target.value })}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {bankLabel(a)}
                  </option>
                ))}
              </NativeSelect>
            </div>
          )}
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="fp-ref">Reference (optional)</Label>
            <Input id="fp-ref" value={d.reference} placeholder="UTR / cheque no." onChange={(e) => setD({ ...d, reference: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!Number(d.amount) || (!voluntary && !shareId) || (voluntary && !d.flatId && !d.payerName.trim())}
            onClick={() =>
              onSave({
                shareId: voluntary ? null : shareId,
                flatId: voluntary ? d.flatId || null : null,
                payerName: d.payerName.trim() || null,
                amount: Number(d.amount),
                paidAt: d.paidAt,
                paymentMode: d.paymentMode,
                bankAccountId: d.paymentMode === 'CASH' ? null : d.bankAccountId || null,
                reference: d.reference.trim() || null,
              })
            }
          >
            Save payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WaiveDialog({ share, onClose, onSave }: { share: Share; onClose: () => void; onSave: (reason: string) => void }) {
  const [reason, setReason] = useState('');
  return (
    <Dialog open onOpenChange={(o: boolean) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Waive {share.flatLabel}’s share?</DialogTitle>
          <DialogDescription>The remaining {rupees(share.due)} will no longer be due. What was already paid stays in the fund.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="wv-reason">Reason</Label>
          <Input id="wv-reason" value={reason} placeholder="e.g. Committee decision of 12 Dec" onChange={(e) => setReason(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={!reason.trim()} onClick={() => onSave(reason.trim())}>
            Waive
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SpendDialog({ balance, onClose, onSave }: { balance: number; onClose: () => void; onSave: (body: any) => void }) {
  const accounts = useBankAccounts();
  const [d, setD] = useState({ description: '', vendorName: '', billNumber: '', amount: '', spentAt: todayIST(), paymentMode: 'BANK' as 'BANK' | 'CASH', bankAccountId: null as string | null });
  const [asAsset, setAsAsset] = useState(false);
  const [assetName, setAssetName] = useState('');
  return (
    <Dialog open onOpenChange={(o: boolean) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record spending from the fund</DialogTitle>
          <DialogDescription>The fund holds {rupees(balance)}. Members can see what it was spent on.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="sp-desc">What for</Label>
            <Input id="sp-desc" value={d.description} placeholder="e.g. Generator purchase, installation" onChange={(e) => setD({ ...d, description: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sp-vendor">Paid to (optional)</Label>
            <Input id="sp-vendor" value={d.vendorName} onChange={(e) => setD({ ...d, vendorName: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sp-bill">Bill no. (optional)</Label>
            <Input id="sp-bill" value={d.billNumber} onChange={(e) => setD({ ...d, billNumber: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sp-amount">Amount (₹)</Label>
            <Input id="sp-amount" type="number" min="1" max={balance} value={d.amount} onChange={(e) => setD({ ...d, amount: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sp-date">Date</Label>
            <Input id="sp-date" type="date" value={d.spentAt} onChange={(e) => setD({ ...d, spentAt: e.target.value })} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="sp-from">Paid from</Label>
            <PaidFromSelect id="sp-from" accounts={accounts} value={{ paymentMode: d.paymentMode, bankAccountId: d.bankAccountId }} onChange={(v) => setD({ ...d, ...v })} />
          </div>
          <div className="space-y-2 rounded-md border p-3 sm:col-span-2">
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-0.5" checked={asAsset} onChange={(e) => setAsAsset(e.target.checked)} />
              <span>
                This bought a fixed asset
                <span className="block text-xs text-muted-foreground">
                  e.g. a generator or solar plant. It is added to the balance sheet as an asset, and the fund used moves to the Capital Reserve. Ask your auditor if unsure.
                </span>
              </span>
            </label>
            {asAsset && (
              <div className="space-y-1.5 pl-6">
                <Label htmlFor="sp-asset">Asset name</Label>
                <Input id="sp-asset" value={assetName} placeholder="e.g. DG Set 125 kVA" onChange={(e) => setAssetName(e.target.value)} />
                <p className="text-xs text-muted-foreground">Use the same name to add to an asset you already have.</p>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!d.description.trim() || !Number(d.amount) || (asAsset && !assetName.trim())}
            onClick={() =>
              onSave({
                description: d.description.trim(),
                vendorName: d.vendorName.trim() || null,
                billNumber: d.billNumber.trim() || null,
                amount: Number(d.amount),
                spentAt: d.spentAt,
                paymentMode: d.paymentMode,
                bankAccountId: d.paymentMode === 'BANK' ? d.bankAccountId : null,
                assetName: asAsset ? assetName.trim() : null,
              })
            }
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
