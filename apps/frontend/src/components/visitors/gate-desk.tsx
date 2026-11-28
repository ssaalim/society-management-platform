'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Download, KeyRound, Loader2, LogIn, LogOut, RefreshCw, Search, ShieldOff, ShieldCheck, UserPlus, X } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { PageHeader } from '@/components/ui/page-header';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { METHOD_LABEL, Notice, VISITOR_TYPES, Visit, VisitStatus, ago, errText, fmtDateTime, fmtTime, helpLabel, todayIST } from './visitor-utils';

interface GateData {
  waiting: Visit[];
  approved: Visit[];
  denied: Visit[];
  inside: Visit[];
}

type CodeResult =
  | { kind: 'PASS'; valid: boolean; problem: string | null; pass: { id: string; guestName: string; guestMobile: string | null; type: string; flatLabel: string; hostName: string | null; validFrom: string; validUntil: string; usesCount: number; maxUses: number; notes: string | null } }
  | { kind: 'DAILY_HELP'; valid: boolean; problem: string | null; help: { id: string; name: string; mobile: string; category: string; flats: { flatId: string; flatLabel: string }[]; insideVisitId: string | null } };

const REFRESH_MS = 20_000;

export function GateDesk() {
  const [tab, setTab] = useState('desk');
  return (
    <div className="space-y-4">
      <PageHeader title="Visitors" description="Gate desk: log visitors, check guest passes and daily help, and keep the entry/exit log." />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="desk">Gate desk</TabsTrigger>
          <TabsTrigger value="log">Log & reports</TabsTrigger>
          <TabsTrigger value="help">Daily help</TabsTrigger>
        </TabsList>
        <TabsContent value="desk">{tab === 'desk' && <Desk />}</TabsContent>
        <TabsContent value="log">{tab === 'log' && <VisitorLog />}</TabsContent>
        <TabsContent value="help">{tab === 'help' && <HelpAdmin />}</TabsContent>
      </Tabs>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ desk

function Desk() {
  const [data, setData] = useState<GateData | null>(null);
  const [flatsList, setFlatsList] = useState<{ id: string; label: string }[]>([]);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get('/visitors/gate');
      setData(res.data.data);
    } catch (err) {
      setNotice({ type: 'error', text: errText(err, 'Could not load the gate desk.') });
    }
  }, []);

  // Refresh while the desk is on screen, so residents' answers show up without reloading.
  useEffect(() => {
    load();
    const t = setInterval(() => document.visibilityState === 'visible' && load(), REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    apiClient
      .get('/flats')
      .then((res) => {
        const list = res.data?.data?.list ?? res.data?.data ?? [];
        setFlatsList(
          list
            .map((f: any) => ({ id: f.id, label: f.wingName ? `${f.wingName}-${f.number}` : f.number }))
            .sort((a: any, b: any) => a.label.localeCompare(b.label, 'en', { numeric: true })),
        );
      })
      .catch(() => setFlatsList([]));
  }, []);

  const act = async (fn: () => Promise<any>, text: string) => {
    setBusy(true);
    setNotice(null);
    try {
      await fn();
      await load();
      setNotice({ type: 'success', text });
      return true;
    } catch (err) {
      setNotice({ type: 'error', text: errText(err, 'That did not work.') });
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Notice notice={notice} />
      <div className="grid gap-4 lg:grid-cols-2">
        <CodeCheck act={act} busy={busy} />
        <WalkInForm flats={flatsList} act={act} busy={busy} />
      </div>

      {!data ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <VisitList
            title="Waiting for residents"
            empty="Nobody waiting."
            visits={data.waiting}
            hint="The flat has been notified in the app. If you reach them by phone, record their answer."
            actions={(v) => (
              <>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => act(() => apiClient.post(`/visitors/${v.id}/guard-decision`, { approve: true }), `${v.name} let in (confirmed by phone).`)}>
                  <Check /> Said yes on phone
                </Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => act(() => apiClient.post(`/visitors/${v.id}/guard-decision`, { approve: false, note: 'Turned away at the gate' }), `${v.name} turned away.`)}>
                  <X /> Turn away
                </Button>
              </>
            )}
          />
          <VisitList
            title="Allowed: let them in"
            empty="No one waiting to enter."
            visits={data.approved}
            actions={(v) => (
              <Button size="sm" disabled={busy} onClick={() => act(() => apiClient.post(`/visitors/${v.id}/let-in`), `${v.name} is inside.`)}>
                <LogIn /> Let in
              </Button>
            )}
          />
          <VisitList
            title={`Inside now (${data.inside.length})`}
            empty="Nobody inside."
            visits={data.inside}
            actions={(v) => (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => act(() => apiClient.post(`/visitors/${v.id}/exit`), `${v.name} has left.`)}>
                <LogOut /> Exit
              </Button>
            )}
          />
          {data.denied.length > 0 && <VisitList title="Recently denied" empty="" visits={data.denied} />}
        </div>
      )}
    </div>
  );
}

function VisitList({ title, empty, visits, hint, actions }: { title: string; empty: string; visits: Visit[]; hint?: string; actions?: (v: Visit) => React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {hint && visits.length > 0 && <p className="text-xs text-muted-foreground">{hint}</p>}
        {visits.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          visits.map((v) => (
            <div key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2.5 text-sm">
              <div>
                <div className="font-medium">
                  {v.name}
                  {v.headcount > 1 && ` +${v.headcount - 1}`} <span className="font-normal text-muted-foreground">→ {v.flatLabel}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {v.typeLabel}
                  {v.company ? `, ${v.company}` : ''} · {v.mobile}
                  {v.vehicleNumber ? ` · ${v.vehicleNumber}` : ''} · {v.status === 'INSIDE' ? `in since ${fmtTime(v.enteredAt)}` : ago(v.entryTime)}
                  {v.approvalMethod && ` · ${METHOD_LABEL[v.approvalMethod] || ''}`}
                  {v.status === 'DENIED' && v.decisionNote && ` · ${v.decisionNote}`}
                </div>
              </div>
              {actions && <div className="flex flex-wrap gap-1.5">{actions(v)}</div>}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function CodeCheck({ act, busy }: { act: (fn: () => Promise<any>, text: string) => Promise<boolean>; busy: boolean }) {
  const [code, setCode] = useState('');
  const [result, setResult] = useState<CodeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flatId, setFlatId] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const check = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    setResult(null);
    // A scanned QR reads "GATEPASS:123456"; keep only the digits.
    const digits = code.replace(/\D/g, '');
    if (digits.length !== 6) return setError('Enter the 6-digit code.');
    try {
      const res = await apiClient.get(`/visitors/code/${digits}`);
      setResult(res.data.data);
      setFlatId('');
    } catch (err) {
      setError(errText(err, 'Code not found.'));
    }
  };

  const done = () => {
    setCode('');
    setResult(null);
    inputRef.current?.focus();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4" /> Guest pass or daily help code
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <form onSubmit={check} className="flex gap-2">
          <Input ref={inputRef} aria-label="Code" inputMode="numeric" autoComplete="off" placeholder="6-digit code" className="font-mono text-lg tracking-widest" value={code} onChange={(e) => setCode(e.target.value)} />
          <Button type="submit">
            <Search /> Check
          </Button>
        </form>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        {result?.kind === 'PASS' && (
          <div className={`space-y-2 rounded-md border p-3 text-sm ${result.valid ? 'border-emerald-300 dark:border-emerald-800' : 'border-red-300 dark:border-red-800'}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">
                {result.pass.guestName} → {result.pass.flatLabel}
              </span>
              <Badge variant={result.valid ? 'success' : 'danger'}>{result.valid ? 'Valid pass' : 'Not valid'}</Badge>
            </div>
            <div className="text-muted-foreground">
              Invited by {result.pass.hostName || 'the resident'} · {fmtDateTime(result.pass.validFrom)} – {fmtDateTime(result.pass.validUntil)} · used {result.pass.usesCount} of {result.pass.maxUses}
              {result.pass.notes && ` · ${result.pass.notes}`}
            </div>
            {result.problem && <div className="text-red-600 dark:text-red-400">{result.problem}</div>}
            {result.valid && (
              <Button size="sm" disabled={busy} onClick={async () => (await act(() => apiClient.post(`/visitors/code/${code.replace(/\D/g, '')}/enter`, {}), `${result.pass.guestName} let in with the pass.`)) && done()}>
                <LogIn /> Let in
              </Button>
            )}
          </div>
        )}
        {result?.kind === 'DAILY_HELP' && (
          <div className={`space-y-2 rounded-md border p-3 text-sm ${result.valid ? 'border-emerald-300 dark:border-emerald-800' : 'border-red-300 dark:border-red-800'}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">
                {result.help.name} · {helpLabel(result.help.category)}
              </span>
              <Badge variant={result.valid ? 'success' : 'danger'}>{result.valid ? 'Daily help' : 'Not allowed'}</Badge>
            </div>
            <div className="text-muted-foreground">
              {result.help.mobile} · works at {result.help.flats.map((f) => f.flatLabel).join(', ') || 'no flat'}
            </div>
            {result.problem && <div className="text-red-600 dark:text-red-400">{result.problem}</div>}
            {result.valid &&
              (result.help.insideVisitId ? (
                <Button size="sm" variant="outline" disabled={busy} onClick={async () => (await act(() => apiClient.post(`/visitors/${result.help.insideVisitId}/exit`), `${result.help.name} has left.`)) && done()}>
                  <LogOut /> Mark exit
                </Button>
              ) : (
                <div className="flex flex-wrap items-end gap-2">
                  {result.help.flats.length > 1 && (
                    <NativeSelect aria-label="Going to flat" className="w-auto" value={flatId} onChange={(e) => setFlatId(e.target.value)}>
                      <option value="">Going to…</option>
                      {result.help.flats.map((f) => (
                        <option key={f.flatId} value={f.flatId}>
                          {f.flatLabel}
                        </option>
                      ))}
                    </NativeSelect>
                  )}
                  <Button
                    size="sm"
                    disabled={busy || (result.help.flats.length > 1 && !flatId)}
                    onClick={async () =>
                      (await act(() => apiClient.post(`/visitors/code/${code.replace(/\D/g, '')}/enter`, { flatId: flatId || null }), `${result.help.name} is inside.`)) && done()
                    }
                  >
                    <LogIn /> Let in
                  </Button>
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const emptyWalkIn = { flatId: '', name: '', mobile: '', type: 'GUEST', company: '', vehicleNumber: '', headcount: '1', purpose: '', confirmedByPhone: false };

function WalkInForm({ flats, act, busy }: { flats: { id: string; label: string }[]; act: (fn: () => Promise<any>, text: string) => Promise<boolean>; busy: boolean }) {
  const [d, setD] = useState(emptyWalkIn);
  const set = (patch: Partial<typeof d>) => setD((x) => ({ ...x, ...patch }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = {
      ...d,
      company: d.company.trim() || null,
      vehicleNumber: d.vehicleNumber.trim().toUpperCase() || null,
      purpose: d.purpose.trim() || null,
      headcount: Number(d.headcount) || 1,
    };
    const flat = flats.find((f) => f.id === d.flatId)?.label;
    const ok = await act(
      () => apiClient.post('/visitors', body),
      d.confirmedByPhone ? `${d.name} let in for ${flat}.` : `${d.name} logged. ${flat} has been asked to allow them.`,
    );
    if (ok) setD(emptyWalkIn);
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserPlus className="h-4 w-4" /> Log a visitor
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="wi-flat">Flat</Label>
            <NativeSelect id="wi-flat" value={d.flatId} onChange={(e) => set({ flatId: e.target.value })}>
              <option value="">Choose…</option>
              {flats.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wi-type">Type</Label>
            <NativeSelect id="wi-type" value={d.type} onChange={(e) => set({ type: e.target.value })}>
              {VISITOR_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wi-name">Name</Label>
            <Input id="wi-name" value={d.name} onChange={(e) => set({ name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wi-mobile">Mobile</Label>
            <Input id="wi-mobile" inputMode="tel" value={d.mobile} onChange={(e) => set({ mobile: e.target.value })} />
          </div>
          {['DELIVERY', 'CAB', 'SERVICE'].includes(d.type) && (
            <div className="space-y-1.5">
              <Label htmlFor="wi-company">Company</Label>
              <Input id="wi-company" value={d.company} placeholder={d.type === 'CAB' ? 'Uber, Ola…' : d.type === 'DELIVERY' ? 'Swiggy, Amazon…' : ''} onChange={(e) => set({ company: e.target.value })} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="wi-vehicle">Vehicle no. (optional)</Label>
            <Input id="wi-vehicle" value={d.vehicleNumber} onChange={(e) => set({ vehicleNumber: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wi-count">People</Label>
            <Input id="wi-count" type="number" min="1" max="100" value={d.headcount} onChange={(e) => set({ headcount: e.target.value })} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="wi-purpose">Purpose (optional)</Label>
            <Input id="wi-purpose" value={d.purpose} onChange={(e) => set({ purpose: e.target.value })} />
          </div>
          <label className="flex items-start gap-2 text-sm sm:col-span-2">
            <input type="checkbox" className="mt-0.5" checked={d.confirmedByPhone} onChange={(e) => set({ confirmedByPhone: e.target.checked })} />
            <span>
              Resident already agreed on the phone: let them in now
              <span className="block text-xs text-muted-foreground">Otherwise the flat is asked in the app and the visitor waits here.</span>
            </span>
          </label>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={busy || !d.flatId || !d.name.trim() || !d.mobile.trim()}>
              {busy && <Loader2 className="animate-spin" />} {d.confirmedByPhone ? 'Let in' : 'Ask the resident'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------------------------------------------ log

function VisitorLog() {
  const [f, setF] = useState({ from: todayIST(), to: todayIST(), type: '', status: '', search: '' });
  const [data, setData] = useState<{ visits: Visit[]; summary: { total: number; denied: number; insideNow: number; byType: Record<string, number> } } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const params = Object.fromEntries(Object.entries(f).filter(([, v]) => v));
      const res = await apiClient.get('/visitors/log', { params });
      setData(res.data.data);
    } catch (err) {
      setError(errText(err, 'Could not load the log.'));
    }
  }, [f]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exportCsv = () => {
    if (!data) return;
    const rows = [['Logged at', 'Entered', 'Exited', 'Name', 'Mobile', 'People', 'Type', 'Company', 'Vehicle', 'Flat', 'Status', 'How allowed', 'By', 'Note']];
    for (const v of data.visits) {
      rows.push([
        fmtDateTime(v.entryTime),
        fmtDateTime(v.enteredAt),
        fmtDateTime(v.exitTime),
        v.name,
        v.mobile,
        String(v.headcount),
        v.typeLabel,
        v.company || '',
        v.vehicleNumber || '',
        v.flatLabel,
        v.status,
        v.approvalMethod ? METHOD_LABEL[v.approvalMethod] || v.approvalMethod : '',
        v.decidedByName || '',
        v.decisionNote || '',
      ]);
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `visitors-${f.from}-to-${f.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="lg-from">From</Label>
            <Input id="lg-from" type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lg-to">To</Label>
            <Input id="lg-to" type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lg-type">Type</Label>
            <NativeSelect id="lg-type" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
              <option value="">All</option>
              {[...VISITOR_TYPES, { value: 'DAILY_HELP', label: 'Daily help' }].map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lg-status">Status</Label>
            <NativeSelect id="lg-status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
              <option value="">All</option>
              <option value="INSIDE">Inside</option>
              <option value="EXITED">Left</option>
              <option value="DENIED">Denied</option>
              <option value="PENDING">Waiting / no response</option>
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lg-search">Name, mobile or vehicle</Label>
            <Input id="lg-search" value={f.search} onChange={(e) => setF({ ...f, search: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && load()} />
          </div>
          <Button onClick={load}>
            <RefreshCw /> Show
          </Button>
          <Button variant="outline" onClick={exportCsv} disabled={!data?.visits.length}>
            <Download /> CSV
          </Button>
        </CardContent>
      </Card>
      {error && <Notice notice={{ type: 'error', text: error }} />}
      {data && (
        <>
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant="info">{data.summary.total} people</Badge>
            {Object.entries(data.summary.byType).map(([t, n]) => (
              <Badge key={t} variant="outline">
                {[...VISITOR_TYPES, { value: 'DAILY_HELP', label: 'Daily help' }].find((x) => x.value === t)?.label || t}: {n}
              </Badge>
            ))}
            {data.summary.denied > 0 && <Badge variant="danger">{data.summary.denied} denied</Badge>}
            {data.summary.insideNow > 0 && <Badge variant="success">{data.summary.insideNow} still inside</Badge>}
          </div>
          <Card>
            <CardContent className="p-0">
              {data.visits.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">No visitors in this period.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Visitor</TableHead>
                        <TableHead>Flat</TableHead>
                        <TableHead>In / out</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.visits.map((v) => (
                        <TableRow key={v.id}>
                          <TableCell className="whitespace-nowrap text-sm">{fmtDateTime(v.entryTime)}</TableCell>
                          <TableCell>
                            <div className="font-medium">
                              {v.name}
                              {v.headcount > 1 && ` +${v.headcount - 1}`}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {v.typeLabel}
                              {v.company ? `, ${v.company}` : ''} · {v.mobile}
                              {v.vehicleNumber ? ` · ${v.vehicleNumber}` : ''}
                            </div>
                          </TableCell>
                          <TableCell>{v.flatLabel}</TableCell>
                          <TableCell className="whitespace-nowrap text-sm">
                            {fmtTime(v.enteredAt)} – {fmtTime(v.exitTime)}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-0.5">
                              <VisitStatus v={v} />
                              {v.approvalMethod && (
                                <span className="text-xs text-muted-foreground">
                                  {METHOD_LABEL[v.approvalMethod]}
                                  {v.decidedByName && v.approvalMethod !== 'PASS' ? ` · ${v.decidedByName}` : ''}
                                </span>
                              )}
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
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ daily help admin

function HelpAdmin() {
  const [list, setList] = useState<any[] | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const load = useCallback(async () => {
    try {
      const res = await apiClient.get('/visitors/daily-help/list');
      setList(res.data.data);
    } catch (err) {
      setNotice({ type: 'error', text: errText(err, 'Could not load daily help.') });
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (h: any) => {
    if (h.isActive && !window.confirm(`Block ${h.name}? Their code will stop working at the gate.`)) return;
    try {
      await apiClient.patch(`/visitors/daily-help/${h.id}`, { isActive: !h.isActive });
      await load();
      setNotice({ type: 'success', text: `${h.name} ${h.isActive ? 'blocked' : 'unblocked'}.` });
    } catch (err) {
      setNotice({ type: 'error', text: errText(err, 'That did not work.') });
    }
  };

  return (
    <div className="space-y-3">
      <Notice notice={notice} />
      <Card>
        <CardContent className="p-0">
          {!list ? (
            <Loader2 className="m-6 h-4 w-4 animate-spin text-muted-foreground" />
          ) : list.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No daily help registered. Residents add their own from the Visitors page.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Works at</TableHead>
                    <TableHead>Last 30 days</TableHead>
                    <TableHead className="w-28" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell>
                        <div className="font-medium">{h.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {helpLabel(h.category)} · {h.mobile}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono">{h.code}</TableCell>
                      <TableCell className="text-sm">{h.flats.map((f: any) => f.flatLabel).join(', ') || '—'}</TableCell>
                      <TableCell className="text-sm">
                        {h.recent.length} visits
                        {h.isInside && (
                          <Badge variant="success" className="ml-1">
                            Inside
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant={h.isActive ? 'ghost' : 'outline'} className={h.isActive ? 'text-red-600' : ''} onClick={() => toggle(h)}>
                          {h.isActive ? (
                            <>
                              <ShieldOff /> Block
                            </>
                          ) : (
                            <>
                              <ShieldCheck /> Unblock
                            </>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
