'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, CheckCircle2, IndianRupee, Loader2, Pencil, Plus, RotateCcw, Trash2, XCircle } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { bankLabel, useBankAccounts } from '@/components/accounting/paid-from-select';

type Kind = 'BOOKING' | 'SERVICE';
type Pricing = 'FIXED' | 'PER_HOUR' | 'PER_DAY';

interface Charge {
  id: string;
  name: string;
  description: string | null;
  kind: Kind;
  pricing: Pricing;
  rate: string;
  depositAmount: string;
  gstRate: string;
  requiresApproval: boolean;
  residentCanRequest: boolean;
  isActive: boolean;
}

interface Req {
  id: string;
  chargeId: string;
  chargeName: string;
  chargeKind: Kind;
  pricing: Pricing;
  flatId: string;
  flatLabel: string;
  requesterName: string | null;
  requestedBy: string | null;
  startAt: string | null;
  endAt: string | null;
  quantity: string;
  purpose: string | null;
  status: 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'COMPLETED';
  chargeAmount: string;
  gstAmount: string;
  depositAmount: string;
  totalAmount: string;
  invoiceNumber: string | null;
  decisionNote: string | null;
  paymentStatus: 'UNPAID' | 'PAID';
  receiptNumber: string | null;
  paidAt: string | null;
  paymentMode: string | null;
  paymentReference: string | null;
  depositStatus: 'NONE' | 'HELD' | 'REFUNDED';
  depositRefunded: string | null;
  depositRefundedAt: string | null;
  depositNote: string | null;
  createdAt: string;
}

interface FlatOption {
  id: string;
  number: string;
  wingName?: string | null;
}

const rupees = (v: number | string) => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const errText = (err: any, fallback: string) => {
  const m = err?.response?.data?.message;
  const details = err?.response?.data?.errors;
  if (Array.isArray(details) && details.length) return details.map((d: any) => d.message).join(' ');
  return (Array.isArray(m) ? m.join(' ') : m) || fallback;
};
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
/** A datetime-local value ("2026-12-05T18:00") as an Indian-time instant. */
const toInstant = (local: string) => (local ? `${local}:00+05:30` : null);
const fmtDateTime = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '—';
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' });
const fmtDate = (d: string | null) =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

function when(r: Pick<Req, 'startAt' | 'endAt'>) {
  if (!r.startAt) return '—';
  if (!r.endAt) return fmtDateTime(r.startAt);
  const sameDay = new Date(r.startAt).toDateString() === new Date(r.endAt).toDateString();
  return sameDay ? `${fmtDateTime(r.startAt)} – ${fmtTime(r.endAt)}` : `${fmtDateTime(r.startAt)} – ${fmtDateTime(r.endAt)}`;
}

const PRICING_UNIT: Record<Pricing, string> = { FIXED: '', PER_HOUR: ' / hour', PER_DAY: ' / day' };
const priceText = (c: Pick<Charge, 'rate' | 'pricing' | 'gstRate' | 'depositAmount'>) => {
  const parts = [`${rupees(c.rate)}${PRICING_UNIT[c.pricing]}`];
  if (Number(c.gstRate) > 0) parts.push(`+ ${Number(c.gstRate)}% GST`);
  if (Number(c.depositAmount) > 0) parts.push(`+ ${rupees(c.depositAmount)} refundable deposit`);
  return parts.join(' ');
};

const STATUS: Record<Req['status'], { label: string; variant: 'warning' | 'info' | 'success' | 'danger' | 'muted' }> = {
  REQUESTED: { label: 'Waiting for approval', variant: 'warning' },
  APPROVED: { label: 'Approved', variant: 'info' },
  COMPLETED: { label: 'Done', variant: 'success' },
  REJECTED: { label: 'Rejected', variant: 'danger' },
  CANCELLED: { label: 'Cancelled', variant: 'muted' },
};

function PaymentBadge({ r }: { r: Req }) {
  if (r.status === 'REJECTED' || r.status === 'CANCELLED') return null;
  if (Number(r.totalAmount) === 0) return <Badge variant="muted">Free</Badge>;
  if (r.paymentStatus === 'PAID') return <Badge variant="success">Paid</Badge>;
  return r.status === 'REQUESTED' ? <Badge variant="muted">Not invoiced</Badge> : <Badge variant="warning">Unpaid</Badge>;
}

function DepositBadge({ r }: { r: Req }) {
  if (r.depositStatus === 'HELD') return <Badge variant="info">Deposit held</Badge>;
  if (r.depositStatus === 'REFUNDED') return <Badge variant="muted">Deposit refunded</Badge>;
  return null;
}

/** Estimated cost of a request (mirrors the server: hours or days rounded up). */
function estimate(c: Charge | undefined, startLocal: string, endLocal: string) {
  if (!c) return null;
  let qty = 1;
  if (c.pricing !== 'FIXED') {
    if (!startLocal || !endLocal) return null;
    const ms = new Date(toInstant(endLocal)!).getTime() - new Date(toInstant(startLocal)!).getTime();
    if (!(ms > 0)) return null;
    qty = c.pricing === 'PER_HOUR' ? Math.ceil(ms / 3_600_000) : Math.ceil(ms / 86_400_000);
  }
  const charge = Math.round(Number(c.rate) * qty * 100) / 100;
  const gst = Math.round(((charge * Number(c.gstRate)) / 100) * 100) / 100;
  const deposit = Number(c.depositAmount);
  return { qty, charge, gst, deposit, total: charge + gst + deposit };
}

// ------------------------------------------------------------------------------------------------ main view

export function FacilitiesView({ isOffice, canAccount }: { isOffice: boolean; canAccount: boolean }) {
  const [charges, setCharges] = useState<Charge[]>([]);
  const [requests, setRequests] = useState<Req[]>([]);
  const [summary, setSummary] = useState<{ pending: number; unpaid: number; depositsHeld: number } | null>(null);
  const [flatsList, setFlatsList] = useState<FlatOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [filter, setFilter] = useState<'ACTIVE' | 'REQUESTED' | 'UNPAID' | 'DEPOSIT' | 'ALL'>('ACTIVE');
  const [requesting, setRequesting] = useState<{ chargeId: string } | null>(null);
  const [selected, setSelected] = useState<Req | null>(null);
  const [editing, setEditing] = useState<{ id?: string; draft: ChargeDraft } | null>(null);

  const load = useCallback(async () => {
    try {
      const [c, r, s] = await Promise.all([
        apiClient.get('/facilities/charges'),
        apiClient.get('/facilities/requests'),
        isOffice ? apiClient.get('/facilities/summary') : Promise.resolve(null),
      ]);
      setCharges(c.data?.data || []);
      setRequests(r.data?.data || []);
      if (s) setSummary(s.data?.data || null);
    } catch (err) {
      setNotice({ type: 'error', text: errText(err, 'Could not load facilities.') });
    } finally {
      setLoading(false);
    }
  }, [isOffice]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!isOffice) return;
    apiClient
      .get('/flats')
      .then((res) => {
        const list = res.data?.data?.list ?? res.data?.data ?? [];
        setFlatsList(list);
      })
      .catch(() => setFlatsList([]));
  }, [isOffice]);

  const shown = useMemo(() => {
    switch (filter) {
      case 'REQUESTED':
        return requests.filter((r) => r.status === 'REQUESTED');
      case 'UNPAID':
        return requests.filter((r) => ['APPROVED', 'COMPLETED'].includes(r.status) && r.paymentStatus === 'UNPAID' && Number(r.totalAmount) > 0);
      case 'DEPOSIT':
        return requests.filter((r) => r.depositStatus === 'HELD');
      case 'ACTIVE':
        return requests.filter((r) => !['REJECTED', 'CANCELLED'].includes(r.status) && !(r.status === 'COMPLETED' && r.paymentStatus === 'PAID' && r.depositStatus !== 'HELD'));
      default:
        return requests;
    }
  }, [requests, filter]);

  const afterChange = async (text: string, updated?: Req) => {
    setNotice({ type: 'success', text });
    await load();
    if (updated) setSelected(updated);
  };

  const requestable = charges.filter((c) => c.isActive && (isOffice || c.residentCanRequest));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Facilities & Services"
        description={
          isOffice
            ? 'Hall bookings, flat transfers, lift use and other charges: approve requests, record payments and refund deposits.'
            : 'Book the hall or request a service. The office approves it and tells you what to pay.'
        }
        actions={
          requestable.length > 0 && (
            <Button size="sm" onClick={() => setRequesting({ chargeId: requestable[0].id })}>
              <Plus /> New request
            </Button>
          )
        }
      />

      {notice && (
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
      )}

      {isOffice && summary && (
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { key: 'REQUESTED' as const, label: 'Waiting for approval', value: summary.pending },
            { key: 'UNPAID' as const, label: 'Approved, not paid', value: summary.unpaid },
            { key: 'DEPOSIT' as const, label: 'Deposits to refund', value: summary.depositsHeld },
          ].map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setFilter(s.key)}
              className={`rounded-md border bg-card p-3 text-left transition hover:border-brand-300 ${filter === s.key ? 'border-brand-500 ring-1 ring-brand-500' : ''}`}
            >
              <div className="text-xs text-muted-foreground">{s.label}</div>
              <div className="text-2xl font-semibold tabular-nums">{s.value}</div>
            </button>
          ))}
        </div>
      )}

      <Tabs defaultValue="requests">
        <TabsList>
          <TabsTrigger value="requests">{isOffice ? 'Requests' : 'My requests'}</TabsTrigger>
          <TabsTrigger value="catalogue">{isOffice ? 'Charges & facilities' : 'Facilities & prices'}</TabsTrigger>
        </TabsList>

        <TabsContent value="requests">
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
              <CardTitle className="text-base">{isOffice ? 'Requests' : 'My requests'}</CardTitle>
              <NativeSelect aria-label="Show" className="w-auto" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
                <option value="ACTIVE">Open</option>
                <option value="REQUESTED">Waiting for approval</option>
                <option value="UNPAID">Approved, not paid</option>
                <option value="DEPOSIT">Deposit held</option>
                <option value="ALL">All</option>
              </NativeSelect>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </div>
              ) : shown.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">
                  {requests.length === 0 ? 'No requests yet.' : 'Nothing here. Choose "All" to see older requests.'}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Facility / service</TableHead>
                        <TableHead>Unit</TableHead>
                        <TableHead>When</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {shown.map((r) => (
                        <TableRow key={r.id} className="cursor-pointer" onClick={() => setSelected(r)}>
                          <TableCell>
                            <div className="font-medium text-brand-700 dark:text-brand-300">{r.chargeName}</div>
                            <div className="text-xs text-muted-foreground">
                              {r.invoiceNumber || 'Not invoiced'}
                              {isOffice && r.requesterName ? ` · ${r.requesterName}` : ''}
                            </div>
                          </TableCell>
                          <TableCell>{r.flatLabel}</TableCell>
                          <TableCell className="whitespace-nowrap text-sm">{when(r)}</TableCell>
                          <TableCell className="text-right tabular-nums">{rupees(r.totalAmount)}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              <Badge variant={STATUS[r.status].variant}>{STATUS[r.status].label}</Badge>
                              <PaymentBadge r={r} />
                              <DepositBadge r={r} />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="catalogue">
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
              <div>
                <CardTitle className="text-base">{isOffice ? 'Charges & facilities' : 'Facilities & prices'}</CardTitle>
                <CardDescription>
                  {isOffice
                    ? 'What members can book or request, and what it costs. Each one has its own income account.'
                    : 'Deposits are returned after the booking, less any damage.'}
                </CardDescription>
              </div>
              {isOffice && (
                <Button size="sm" variant="outline" onClick={() => setEditing({ draft: emptyDraft() })}>
                  <Plus /> Add
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {charges.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">
                  {isOffice ? 'Nothing set up yet. Add the clubhouse hall, flat transfer fee, lift use for shifting, and so on.' : 'The society has not listed any facilities yet.'}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>How it works</TableHead>
                        <TableHead className="w-24" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {charges.map((c) => (
                        <TableRow key={c.id} className={c.isActive ? '' : 'opacity-60'}>
                          <TableCell>
                            <div className="font-medium">{c.name}</div>
                            {c.description && <div className="text-xs text-muted-foreground">{c.description}</div>}
                          </TableCell>
                          <TableCell className="text-sm">{priceText(c)}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              <Badge variant="outline">{c.kind === 'BOOKING' ? 'Booking (no overlaps)' : 'Service'}</Badge>
                              <Badge variant={c.requiresApproval ? 'muted' : 'success'}>{c.requiresApproval ? 'Needs approval' : 'Approved at once'}</Badge>
                              {isOffice && !c.residentCanRequest && <Badge variant="muted">Office only</Badge>}
                              {!c.isActive && <Badge variant="danger">Off</Badge>}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {isOffice ? (
                              <Button variant="ghost" size="icon-sm" aria-label={`Edit ${c.name}`} onClick={() => setEditing({ id: c.id, draft: toDraft(c) })}>
                                <Pencil />
                              </Button>
                            ) : (
                              c.isActive && (
                                <Button size="sm" variant="outline" onClick={() => setRequesting({ chargeId: c.id })}>
                                  Request
                                </Button>
                              )
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {requesting && (
        <RequestDialog
          charges={requestable}
          initialChargeId={requesting.chargeId}
          isOffice={isOffice}
          flatsList={flatsList}
          onClose={() => setRequesting(null)}
          onCreated={(r) => {
            setRequesting(null);
            afterChange(
              r.status === 'APPROVED'
                ? `${r.chargeName} confirmed (invoice ${r.invoiceNumber}).`
                : `${r.chargeName} requested. The office will approve it and tell you what to pay.`,
            );
          }}
        />
      )}

      {selected && (
        <RequestDetails
          request={selected}
          isOffice={isOffice}
          canAccount={canAccount}
          onClose={() => setSelected(null)}
          onChanged={(text, updated) => afterChange(text, updated)}
        />
      )}

      {editing && (
        <ChargeEditor
          id={editing.id}
          initial={editing.draft}
          onClose={() => setEditing(null)}
          onSaved={(text) => {
            setEditing(null);
            afterChange(text);
          }}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ request form

function RequestDialog({
  charges,
  initialChargeId,
  isOffice,
  flatsList,
  onClose,
  onCreated,
}: {
  charges: Charge[];
  initialChargeId: string;
  isOffice: boolean;
  flatsList: FlatOption[];
  onClose: () => void;
  onCreated: (r: Req) => void;
}) {
  const [chargeId, setChargeId] = useState(initialChargeId);
  const [flatId, setFlatId] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [purpose, setPurpose] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState<{ startAt: string; endAt: string; status: string }[] | null>(null);

  const charge = charges.find((c) => c.id === chargeId);
  const timed = !!charge && (charge.kind === 'BOOKING' || charge.pricing !== 'FIXED');
  const est = estimate(charge, start, end);
  const day = start.slice(0, 10);

  // A previous error no longer applies once the details change.
  useEffect(() => setError(null), [chargeId, flatId, start, end]);

  // Show what is already booked on the chosen day.
  useEffect(() => {
    if (!charge || charge.kind !== 'BOOKING' || !day) {
      setBooked(null);
      return;
    }
    const from = `${day}T00:00:00+05:30`;
    const nextDay = new Date(new Date(from).getTime() + 86_400_000);
    const to = `${new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(nextDay)}T00:00:00+05:30`;
    apiClient
      .get(`/facilities/charges/${charge.id}/bookings`, { params: { from, to } })
      .then((res) => setBooked(res.data?.data || []))
      .catch(() => setBooked(null));
  }, [charge, day]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiClient.post('/facilities/requests', {
        chargeId,
        flatId: isOffice ? flatId || null : null,
        startAt: toInstant(start),
        endAt: timed ? toInstant(end) : null,
        purpose: purpose.trim() || null,
      });
      onCreated(res.data.data);
    } catch (err) {
      setError(errText(err, 'Could not send the request.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New request</DialogTitle>
          <DialogDescription>{charge ? priceText(charge) : 'Choose what you need.'}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="req-charge">Facility or service</Label>
            <NativeSelect id="req-charge" value={chargeId} onChange={(e) => setChargeId(e.target.value)}>
              {charges.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
            {charge?.description && <p className="text-xs text-muted-foreground">{charge.description}</p>}
          </div>

          {isOffice && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="req-flat">Unit</Label>
              <NativeSelect id="req-flat" value={flatId} onChange={(e) => setFlatId(e.target.value)}>
                <option value="">Choose a unit…</option>
                {flatsList.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.wingName ? `${f.wingName}-${f.number}` : f.number}
                  </option>
                ))}
              </NativeSelect>
            </div>
          )}

          <div className={`space-y-1.5 ${timed ? '' : 'sm:col-span-2'}`}>
            <Label htmlFor="req-start">{timed ? 'From' : 'Date (optional)'}</Label>
            <Input id="req-start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          {timed && (
            <div className="space-y-1.5">
              <Label htmlFor="req-end">To</Label>
              <Input id="req-end" type="datetime-local" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} />
            </div>
          )}

          {booked && (
            <div className="rounded-md border bg-muted/40 p-2.5 text-xs sm:col-span-2">
              {booked.length === 0 ? (
                <span className="text-emerald-700 dark:text-emerald-400">Nothing booked that day yet.</span>
              ) : (
                <>
                  <div className="mb-1 font-medium">Already booked that day:</div>
                  <ul className="space-y-0.5">
                    {booked.map((b, i) => (
                      <li key={i} className="flex items-center gap-1.5">
                        <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                        {fmtTime(b.startAt)} – {fmtTime(b.endAt)}
                        {b.status === 'REQUESTED' && <span className="text-muted-foreground">(waiting for approval)</span>}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="req-purpose">Purpose / notes</Label>
            <Textarea id="req-purpose" rows={2} value={purpose} placeholder="e.g. Birthday party, about 40 guests" onChange={(e) => setPurpose(e.target.value)} />
          </div>

          {est && (
            <div className="rounded-md border p-3 text-sm sm:col-span-2">
              <Row label={charge!.pricing === 'FIXED' ? 'Charge' : `Charge (${est.qty} ${charge!.pricing === 'PER_HOUR' ? 'hour' : 'day'}${est.qty === 1 ? '' : 's'})`} value={est.charge} />
              {est.gst > 0 && <Row label={`GST ${Number(charge!.gstRate)}%`} value={est.gst} />}
              {est.deposit > 0 && <Row label="Refundable deposit" value={est.deposit} />}
              <div className="mt-1.5 flex justify-between border-t pt-1.5 font-semibold">
                <span>Total payable</span>
                <span className="tabular-nums">{rupees(est.total)}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {charge!.requiresApproval ? 'Pay after the office approves it.' : 'Confirmed at once; pay at the society office.'}
              </p>
            </div>
          )}
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || !charge || (isOffice && !flatId) || (timed && (!start || !end))}>
            {busy && <Loader2 className="animate-spin" />} {charge?.requiresApproval ? 'Send request' : 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{rupees(value)}</span>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ details & actions

function RequestDetails({
  request: r,
  isOffice,
  canAccount,
  onClose,
  onChanged,
}: {
  request: Req;
  isOffice: boolean;
  canAccount: boolean;
  onClose: () => void;
  onChanged: (text: string, updated?: Req) => void;
}) {
  const [mode, setMode] = useState<'view' | 'reject' | 'pay' | 'refund'>('view');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const accounts = useBankAccounts();
  const [pay, setPay] = useState({ paidAt: today(), paymentMode: 'UPI', bankAccountId: '', reference: '' });
  const [refund, setRefund] = useState({ refundAmount: String(Number(r.depositAmount)), refundedAt: today(), paymentMode: 'NEFT', bankAccountId: '', note: '' });

  useEffect(() => {
    setMode('view');
    setError(null);
    setNote('');
  }, [r.id, r.status, r.paymentStatus, r.depositStatus]);

  const act = async (path: string, body: any, text: (u: Req) => string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiClient.post(`/facilities/requests/${r.id}/${path}`, body);
      onChanged(text(res.data.data), res.data.data);
    } catch (err) {
      setError(errText(err, 'That did not work.'));
    } finally {
      setBusy(false);
    }
  };

  const bankFor = (m: string, id: string) => (m === 'CASH' ? null : id || null);
  const kept = Math.max(0, Number(r.depositAmount) - (Number(refund.refundAmount) || 0));
  const canCancel = ['REQUESTED', 'APPROVED'].includes(r.status) && r.paymentStatus === 'UNPAID';

  return (
    <Dialog open onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{r.chargeName}</DialogTitle>
          <DialogDescription>
            {r.flatLabel}
            {r.requesterName ? ` · requested by ${r.requesterName}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-1">
          <Badge variant={STATUS[r.status].variant}>{STATUS[r.status].label}</Badge>
          <PaymentBadge r={r} />
          <DepositBadge r={r} />
        </div>

        <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-muted-foreground">When</dt>
          <dd>{when(r)}</dd>
          {r.purpose && (
            <>
              <dt className="text-muted-foreground">Purpose</dt>
              <dd>{r.purpose}</dd>
            </>
          )}
          <dt className="text-muted-foreground">Invoice</dt>
          <dd>{r.invoiceNumber || 'Issued on approval'}</dd>
          <dt className="text-muted-foreground">Charge</dt>
          <dd className="tabular-nums">
            {rupees(r.chargeAmount)}
            {r.pricing !== 'FIXED' && ` (${Number(r.quantity)} ${r.pricing === 'PER_HOUR' ? 'h' : 'days'})`}
          </dd>
          {Number(r.gstAmount) > 0 && (
            <>
              <dt className="text-muted-foreground">GST</dt>
              <dd className="tabular-nums">{rupees(r.gstAmount)}</dd>
            </>
          )}
          {Number(r.depositAmount) > 0 && (
            <>
              <dt className="text-muted-foreground">Deposit</dt>
              <dd className="tabular-nums">{rupees(r.depositAmount)} (refundable)</dd>
            </>
          )}
          <dt className="font-medium">Total</dt>
          <dd className="font-medium tabular-nums">{rupees(r.totalAmount)}</dd>
          {r.paymentStatus === 'PAID' && (
            <>
              <dt className="text-muted-foreground">Paid</dt>
              <dd>
                {fmtDate(r.paidAt)} by {r.paymentMode}
                {r.paymentReference ? ` (${r.paymentReference})` : ''}, receipt {r.receiptNumber}
              </dd>
            </>
          )}
          {r.depositStatus === 'REFUNDED' && (
            <>
              <dt className="text-muted-foreground">Deposit refund</dt>
              <dd>
                {rupees(r.depositRefunded || 0)} on {fmtDate(r.depositRefundedAt)}
                {r.depositNote ? `. ${r.depositNote}` : ''}
              </dd>
            </>
          )}
          {r.decisionNote && (
            <>
              <dt className="text-muted-foreground">Office note</dt>
              <dd>{r.decisionNote}</dd>
            </>
          )}
        </dl>

        {mode === 'reject' && (
          <div className="space-y-1.5">
            <Label htmlFor="rej-note">Reason (sent to the member)</Label>
            <Textarea id="rej-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. The hall is under repair that week" />
          </div>
        )}

        {mode === 'pay' && (
          <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pay-date">Received on</Label>
              <Input id="pay-date" type="date" value={pay.paidAt} onChange={(e) => setPay({ ...pay, paidAt: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-mode">Mode</Label>
              <NativeSelect id="pay-mode" value={pay.paymentMode} onChange={(e) => setPay({ ...pay, paymentMode: e.target.value })}>
                {['UPI', 'NEFT', 'CHEQUE', 'CARD', 'CASH'].map((m) => (
                  <option key={m} value={m}>
                    {m === 'CASH' ? 'Cash' : m}
                  </option>
                ))}
              </NativeSelect>
            </div>
            {pay.paymentMode !== 'CASH' && accounts.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="pay-bank">Deposited in</Label>
                <NativeSelect id="pay-bank" value={pay.bankAccountId || accounts[0].id} onChange={(e) => setPay({ ...pay, bankAccountId: e.target.value })}>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {bankLabel(a)}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="pay-ref">Reference (optional)</Label>
              <Input id="pay-ref" value={pay.reference} placeholder="UTR / cheque no." onChange={(e) => setPay({ ...pay, reference: e.target.value })} />
            </div>
          </div>
        )}

        {mode === 'refund' && (
          <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ref-amount">Refund (₹)</Label>
              <Input id="ref-amount" type="number" min="0" max={Number(r.depositAmount)} step="0.01" value={refund.refundAmount} onChange={(e) => setRefund({ ...refund, refundAmount: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ref-date">Refunded on</Label>
              <Input id="ref-date" type="date" value={refund.refundedAt} onChange={(e) => setRefund({ ...refund, refundedAt: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ref-mode">Mode</Label>
              <NativeSelect id="ref-mode" value={refund.paymentMode} onChange={(e) => setRefund({ ...refund, paymentMode: e.target.value })}>
                {['NEFT', 'UPI', 'CHEQUE', 'CASH'].map((m) => (
                  <option key={m} value={m}>
                    {m === 'CASH' ? 'Cash' : m}
                  </option>
                ))}
              </NativeSelect>
            </div>
            {refund.paymentMode !== 'CASH' && accounts.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="ref-bank">Paid from</Label>
                <NativeSelect id="ref-bank" value={refund.bankAccountId || accounts[0].id} onChange={(e) => setRefund({ ...refund, bankAccountId: e.target.value })}>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {bankLabel(a)}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            )}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ref-note">{kept > 0 ? `Why ${rupees(kept)} is kept` : 'Note (optional)'}</Label>
              <Input id="ref-note" value={refund.note} placeholder={kept > 0 ? 'e.g. Two chairs broken' : ''} onChange={(e) => setRefund({ ...refund, note: e.target.value })} />
              {kept > 0 && <p className="text-xs text-muted-foreground">The amount kept is recorded as {r.chargeName} income.</p>}
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <DialogFooter className="flex-wrap gap-2">
          {mode === 'view' && (
            <>
              {!isOffice && canCancel && (
                <Button variant="outline" disabled={busy} onClick={() => window.confirm('Cancel this request?') && act('cancel', {}, () => 'Request cancelled.')}>
                  <XCircle /> Cancel request
                </Button>
              )}
              {isOffice && r.status === 'REQUESTED' && (
                <>
                  <Button variant="outline" disabled={busy} onClick={() => setMode('reject')}>
                    <XCircle /> Reject
                  </Button>
                  <Button disabled={busy} onClick={() => act('approve', {}, (u) => `Approved. Invoice ${u.invoiceNumber}.`)}>
                    <CheckCircle2 /> Approve
                  </Button>
                </>
              )}
              {isOffice && canCancel && r.status === 'APPROVED' && (
                <Button variant="ghost" disabled={busy} onClick={() => window.confirm('Cancel this approved request?') && act('cancel', {}, () => 'Request cancelled.')}>
                  Cancel request
                </Button>
              )}
              {isOffice && r.status === 'APPROVED' && (
                <Button variant="outline" disabled={busy} onClick={() => act('complete', {}, () => 'Marked as done.')}>
                  Mark done
                </Button>
              )}
              {isOffice && canAccount && ['APPROVED', 'COMPLETED'].includes(r.status) && r.paymentStatus === 'UNPAID' && Number(r.totalAmount) > 0 && (
                <Button disabled={busy} onClick={() => setMode('pay')}>
                  <IndianRupee /> Record payment
                </Button>
              )}
              {isOffice && canAccount && r.depositStatus === 'HELD' && (
                <Button variant="outline" disabled={busy} onClick={() => setMode('refund')}>
                  <RotateCcw /> Refund deposit
                </Button>
              )}
              <Button variant="ghost" onClick={onClose}>
                Close
              </Button>
            </>
          )}
          {mode === 'reject' && (
            <>
              <Button variant="outline" onClick={() => setMode('view')} disabled={busy}>
                Back
              </Button>
              <Button variant="destructive" disabled={busy} onClick={() => act('reject', { note: note.trim() || null }, () => 'Request rejected.')}>
                {busy && <Loader2 className="animate-spin" />} Reject request
              </Button>
            </>
          )}
          {mode === 'pay' && (
            <>
              <Button variant="outline" onClick={() => setMode('view')} disabled={busy}>
                Back
              </Button>
              <Button
                disabled={busy}
                onClick={() =>
                  act(
                    'payment',
                    {
                      paidAt: pay.paidAt,
                      paymentMode: pay.paymentMode,
                      bankAccountId: bankFor(pay.paymentMode, pay.bankAccountId),
                      reference: pay.reference.trim() || null,
                    },
                    (u) => `Payment recorded. Receipt ${u.receiptNumber}.`,
                  )
                }
              >
                {busy && <Loader2 className="animate-spin" />} Save payment of {rupees(r.totalAmount)}
              </Button>
            </>
          )}
          {mode === 'refund' && (
            <>
              <Button variant="outline" onClick={() => setMode('view')} disabled={busy}>
                Back
              </Button>
              <Button
                disabled={busy}
                onClick={() =>
                  act(
                    'refund-deposit',
                    {
                      refundAmount: Number(refund.refundAmount) || 0,
                      refundedAt: refund.refundedAt,
                      paymentMode: refund.paymentMode,
                      bankAccountId: bankFor(refund.paymentMode, refund.bankAccountId),
                      note: refund.note.trim() || null,
                    },
                    () => 'Deposit refund recorded.',
                  )
                }
              >
                {busy && <Loader2 className="animate-spin" />} Save refund
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------------------------------------------ catalogue editor

interface ChargeDraft {
  name: string;
  description: string;
  kind: Kind;
  pricing: Pricing;
  rate: string;
  depositAmount: string;
  gstRate: string;
  requiresApproval: boolean;
  residentCanRequest: boolean;
  isActive: boolean;
}

const emptyDraft = (): ChargeDraft => ({
  name: '',
  description: '',
  kind: 'SERVICE',
  pricing: 'FIXED',
  rate: '',
  depositAmount: '',
  gstRate: '0',
  requiresApproval: true,
  residentCanRequest: true,
  isActive: true,
});

const toDraft = (c: Charge): ChargeDraft => ({
  name: c.name,
  description: c.description || '',
  kind: c.kind,
  pricing: c.pricing,
  rate: String(Number(c.rate)),
  depositAmount: Number(c.depositAmount) ? String(Number(c.depositAmount)) : '',
  gstRate: String(Number(c.gstRate)),
  requiresApproval: c.requiresApproval,
  residentCanRequest: c.residentCanRequest,
  isActive: c.isActive,
});

function ChargeEditor({ id, initial, onClose, onSaved }: { id?: string; initial: ChargeDraft; onClose: () => void; onSaved: (text: string) => void }) {
  const [d, setD] = useState<ChargeDraft>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<ChargeDraft>) => setD((x) => ({ ...x, ...patch }));

  const save = async () => {
    setBusy(true);
    setError(null);
    const body = {
      ...d,
      description: d.description.trim() || null,
      rate: Number(d.rate) || 0,
      depositAmount: Number(d.depositAmount) || 0,
      gstRate: Number(d.gstRate) || 0,
    };
    try {
      if (id) await apiClient.patch(`/facilities/charges/${id}`, body);
      else await apiClient.post('/facilities/charges', body);
      onSaved(`${d.name} saved.`);
    } catch (err) {
      setError(errText(err, 'Could not save.'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!id || !window.confirm(`Delete ${d.name}? If it has been requested before, it is switched off instead.`)) return;
    setBusy(true);
    try {
      const res = await apiClient.delete(`/facilities/charges/${id}`);
      onSaved(res.data?.data?.deleted ? `${d.name} deleted.` : `${d.name} has past requests, so it was switched off instead.`);
    } catch (err) {
      setError(errText(err, 'Could not delete.'));
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{id ? `Edit ${initial.name}` : 'Add a facility or service'}</DialogTitle>
          <DialogDescription>Price changes apply to new requests; existing ones keep their amounts.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ch-name">Name</Label>
            <Input id="ch-name" value={d.name} placeholder="e.g. Clubhouse hall" onChange={(e) => set({ name: e.target.value })} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ch-desc">Description / rules (optional)</Label>
            <Textarea id="ch-desc" rows={2} value={d.description} placeholder="e.g. Up to 80 guests, music off by 10 pm" onChange={(e) => set({ description: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ch-kind">Type</Label>
            <NativeSelect id="ch-kind" value={d.kind} onChange={(e) => set({ kind: e.target.value as Kind })}>
              <option value="BOOKING">Booking (time slot, no overlaps)</option>
              <option value="SERVICE">Service (one-off)</option>
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ch-pricing">Charged</Label>
            <NativeSelect id="ch-pricing" value={d.pricing} onChange={(e) => set({ pricing: e.target.value as Pricing })}>
              <option value="FIXED">Fixed amount</option>
              <option value="PER_HOUR">Per hour</option>
              <option value="PER_DAY">Per day</option>
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ch-rate">Rate (₹){PRICING_UNIT[d.pricing]}</Label>
            <Input id="ch-rate" type="number" min="0" step="0.01" value={d.rate} onChange={(e) => set({ rate: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ch-deposit">Refundable deposit (₹)</Label>
            <Input id="ch-deposit" type="number" min="0" step="0.01" value={d.depositAmount} placeholder="0" onChange={(e) => set({ depositAmount: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ch-gst">GST %</Label>
            <NativeSelect id="ch-gst" value={d.gstRate} onChange={(e) => set({ gstRate: e.target.value })}>
              {['0', '5', '12', '18', '28'].map((g) => (
                <option key={g} value={g}>
                  {g === '0' ? 'No GST' : `${g}%`}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-2 sm:col-span-2">
            {(
              [
                ['requiresApproval', 'Needs approval', 'Otherwise it is confirmed (and invoiced) as soon as it is requested.'],
                ['residentCanRequest', 'Members can request it in the app', 'Turn off for charges only the office raises, such as a flat transfer fee.'],
                ['isActive', 'Available', 'Turn off to stop new requests.'],
              ] as const
            ).map(([key, label, hint]) => (
              <label key={key} className="flex items-start gap-2.5 text-sm">
                <input type="checkbox" className="mt-0.5" checked={d[key]} onChange={(e) => set({ [key]: e.target.checked } as Partial<ChargeDraft>)} />
                <span>
                  {label}
                  <span className="block text-xs text-muted-foreground">{hint}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <DialogFooter className="gap-2">
          {id && (
            <Button variant="ghost" className="mr-auto text-red-600" onClick={remove} disabled={busy}>
              <Trash2 /> Delete
            </Button>
          )}
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy || !d.name.trim()}>
            {busy && <Loader2 className="animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
