'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Check, Loader2, Plus, QrCode, RefreshCw, Trash2, UserPlus, X } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  HELP_CATEGORIES,
  METHOD_LABEL,
  Notice,
  VISITOR_TYPES,
  Visit,
  VisitStatus,
  ago,
  errText,
  fmtDateTime,
  fmtTime,
  helpLabel,
  localNow,
  toInstant,
} from './visitor-utils';

interface Pass {
  id: string;
  flatId: string;
  guestName: string;
  guestMobile: string | null;
  type: string;
  code: string;
  validFrom: string;
  validUntil: string;
  maxUses: number;
  usesCount: number;
  notes: string | null;
  state: 'ACTIVE' | 'UPCOMING' | 'USED' | 'EXPIRED' | 'CANCELLED';
}

interface Helper {
  id: string;
  name: string;
  mobile: string;
  category: string;
  code: string | null;
  isActive: boolean;
  flats: { flatId: string; flatLabel: string }[];
  otherFlatsCount: number;
  isInside: boolean;
  recent: { id: string; flatId: string; enteredAt: string | null; exitTime: string | null; status: string }[];
}

const PASS_STATE: Record<Pass['state'], { label: string; variant: 'success' | 'info' | 'muted' | 'danger' }> = {
  ACTIVE: { label: 'Active', variant: 'success' },
  UPCOMING: { label: 'Upcoming', variant: 'info' },
  USED: { label: 'Used', variant: 'muted' },
  EXPIRED: { label: 'Expired', variant: 'muted' },
  CANCELLED: { label: 'Cancelled', variant: 'danger' },
};

export function ResidentVisitors() {
  const [visits, setVisits] = useState<Visit[] | null>(null);
  const [myFlats, setMyFlats] = useState<{ id: string; label: string }[]>([]);
  const [passes, setPasses] = useState<Pass[]>([]);
  const [helpers, setHelpers] = useState<Helper[]>([]);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [newPass, setNewPass] = useState(false);
  const [showPass, setShowPass] = useState<Pass | null>(null);
  const [addHelp, setAddHelp] = useState(false);

  const load = useCallback(async () => {
    try {
      const [m, p, h] = await Promise.all([apiClient.get('/visitors/mine'), apiClient.get('/visitors/passes/list'), apiClient.get('/visitors/daily-help/list')]);
      setVisits(m.data.data.visits);
      setMyFlats(m.data.data.flats);
      setPasses(p.data.data);
      setHelpers(h.data.data);
    } catch (err) {
      setNotice({ type: 'error', text: errText(err, 'Could not load visitors.') });
      setVisits([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (fn: () => Promise<any>, text: string) => {
    setBusy(true);
    setNotice(null);
    try {
      await fn();
      await load();
      setNotice({ type: 'success', text });
    } catch (err) {
      setNotice({ type: 'error', text: errText(err, 'That did not work.') });
    } finally {
      setBusy(false);
    }
  };

  const waiting = (visits || []).filter((v) => v.status === 'PENDING' && !v.noResponse);
  const history = (visits || []).filter((v) => !waiting.includes(v));
  const flatLabel = (id: string) => myFlats.find((f) => f.id === id)?.label || '';

  if (visits && !myFlats.length) {
    return (
      <div className="space-y-4">
        <PageHeader title="Visitors" />
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">Your account is not linked to a flat yet. Please contact the society office.</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Visitors"
        description="Allow people at the gate, invite guests with a pass, and keep track of your daily help."
        actions={
          <Button size="sm" variant="outline" onClick={load} aria-label="Refresh">
            <RefreshCw />
          </Button>
        }
      />
      <Notice notice={notice} />

      {waiting.length > 0 && (
        <Card className="border-amber-300 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="text-base">At the gate now</CardTitle>
            <CardDescription>Security is waiting for your answer.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {waiting.map((v) => (
              <div key={v.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
                <div className="text-sm">
                  <div className="font-medium">
                    {v.name}
                    {v.headcount > 1 && ` +${v.headcount - 1}`} <Badge variant="outline">{v.typeLabel}</Badge>
                  </div>
                  <div className="text-muted-foreground">
                    {[v.company, v.mobile, v.vehicleNumber, myFlats.length > 1 ? v.flatLabel : null].filter(Boolean).join(' · ')} · {ago(v.entryTime)}
                  </div>
                  {v.purpose && <div className="text-muted-foreground">{v.purpose}</div>}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" disabled={busy} onClick={() => act(() => apiClient.post(`/visitors/${v.id}/decision`, { approve: true }), `${v.name} allowed. Security will let them in.`)}>
                    <Check /> Allow
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => act(() => apiClient.post(`/visitors/${v.id}/decision`, { approve: false }), `${v.name} turned away.`)}>
                    <X /> Deny
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="history">
        <TabsList>
          <TabsTrigger value="history">Visits</TabsTrigger>
          <TabsTrigger value="passes">Guest passes</TabsTrigger>
          <TabsTrigger value="help">Daily help</TabsTrigger>
        </TabsList>

        <TabsContent value="history">
          <Card>
            <CardContent className="p-0">
              {!visits ? (
                <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </div>
              ) : history.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">No visitors in the last 60 days.</p>
              ) : (
                <ul className="divide-y">
                  {history.map((v) => (
                    <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                      <div>
                        <div className="font-medium">
                          {v.name}
                          {v.headcount > 1 && ` +${v.headcount - 1}`} <span className="font-normal text-muted-foreground">· {v.typeLabel}{v.company ? `, ${v.company}` : ''}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {fmtDateTime(v.enteredAt || v.entryTime)}
                          {v.exitTime && ` – ${fmtTime(v.exitTime)}`}
                          {v.approvalMethod && ` · ${METHOD_LABEL[v.approvalMethod] || ''}`}
                          {v.decidedByName && v.approvalMethod !== 'PASS' && ` by ${v.decidedByName}`}
                          {v.decisionNote && ` · ${v.decisionNote}`}
                          {myFlats.length > 1 && ` · ${v.flatLabel}`}
                        </div>
                      </div>
                      <VisitStatus v={v} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="passes" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">Share the code or QR with your guest. Security lets them in without calling you.</p>
            <Button size="sm" onClick={() => setNewPass(true)}>
              <Plus /> New pass
            </Button>
          </div>
          {passes.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">No passes yet.</CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {passes.map((p) => (
                <Card key={p.id} className={['USED', 'EXPIRED', 'CANCELLED'].includes(p.state) ? 'opacity-70' : ''}>
                  <CardContent className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium">{p.guestName}</div>
                        <div className="text-xs text-muted-foreground">
                          {fmtDateTime(p.validFrom)} – {fmtDateTime(p.validUntil)}
                          {myFlats.length > 1 && ` · ${flatLabel(p.flatId)}`}
                        </div>
                      </div>
                      <Badge variant={PASS_STATE[p.state].variant}>{PASS_STATE[p.state].label}</Badge>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-xl tracking-widest">{p.code}</span>
                      <span className="text-xs text-muted-foreground">
                        Used {p.usesCount} of {p.maxUses}
                      </span>
                    </div>
                    {['ACTIVE', 'UPCOMING'].includes(p.state) && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setShowPass(p)}>
                          <QrCode /> Show QR
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600"
                          disabled={busy}
                          onClick={() => window.confirm(`Cancel the pass for ${p.guestName}?`) && act(() => apiClient.post(`/visitors/passes/${p.id}/revoke`), 'Pass cancelled.')}
                        >
                          Cancel pass
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="help" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">Each helper gets a permanent gate code. Security logs when they come and go.</p>
            <Button size="sm" onClick={() => setAddHelp(true)}>
              <UserPlus /> Add help
            </Button>
          </div>
          {helpers.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">No daily help added.</CardContent>
            </Card>
          ) : (
            helpers.map((h) => (
              <Card key={h.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 font-medium">
                        {h.name} <Badge variant="outline">{helpLabel(h.category)}</Badge>
                        {h.isInside && <Badge variant="success">Inside now</Badge>}
                        {!h.isActive && <Badge variant="danger">Blocked by office</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {h.mobile} · gate code <span className="font-mono">{h.code}</span>
                        {h.otherFlatsCount > 0 && ` · also works in ${h.otherFlatsCount} other flat${h.otherFlatsCount === 1 ? '' : 's'}`}
                      </div>
                    </div>
                    {h.flats.map((f) => (
                      <Button
                        key={f.flatId}
                        size="sm"
                        variant="ghost"
                        className="text-red-600"
                        disabled={busy}
                        onClick={() =>
                          window.confirm(`Remove ${h.name} from ${f.flatLabel}?`) &&
                          act(() => apiClient.delete(`/visitors/daily-help/${h.id}/flats/${f.flatId}`), `${h.name} removed from ${f.flatLabel}.`)
                        }
                      >
                        <Trash2 /> Remove{myFlats.length > 1 ? ` from ${f.flatLabel}` : ''}
                      </Button>
                    ))}
                  </div>
                  <div className="text-xs">
                    <span className="text-muted-foreground">Last 30 days: </span>
                    {h.recent.length === 0
                      ? 'no visits'
                      : h.recent
                          .slice(0, 8)
                          .map((v) => `${fmtDateTime(v.enteredAt)}${v.exitTime ? `–${fmtTime(v.exitTime)}` : ''}`)
                          .join(' · ')}
                    {h.recent.length > 8 && ` … (${h.recent.length} visits)`}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {newPass && (
        <PassForm
          flats={myFlats}
          onClose={() => setNewPass(false)}
          onCreated={(p) => {
            setNewPass(false);
            load();
            setShowPass(p);
          }}
        />
      )}
      {showPass && <PassQr pass={showPass} flat={flatLabel(showPass.flatId)} onClose={() => setShowPass(null)} />}
      {addHelp && (
        <HelpForm
          flats={myFlats}
          onClose={() => setAddHelp(false)}
          onSaved={(text) => {
            setAddHelp(false);
            load();
            setNotice({ type: 'success', text });
          }}
        />
      )}
    </div>
  );
}

function PassForm({ flats, onClose, onCreated }: { flats: { id: string; label: string }[]; onClose: () => void; onCreated: (p: Pass) => void }) {
  const [d, setD] = useState({ flatId: flats[0]?.id || '', guestName: '', guestMobile: '', type: 'GUEST', validFrom: localNow(), validUntil: localNow(6 * 60), maxUses: '1', notes: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiClient.post('/visitors/passes', {
        ...d,
        guestMobile: d.guestMobile.trim() || null,
        notes: d.notes.trim() || null,
        validFrom: toInstant(d.validFrom),
        validUntil: toInstant(d.validUntil),
        maxUses: Number(d.maxUses) || 1,
      });
      onCreated(res.data.data);
    } catch (err) {
      setError(errText(err, 'Could not create the pass.'));
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New guest pass</DialogTitle>
          <DialogDescription>Valid only between these times.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          {flats.length > 1 && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ps-flat">Flat</Label>
              <NativeSelect id="ps-flat" value={d.flatId} onChange={(e) => setD({ ...d, flatId: e.target.value })}>
                {flats.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
          )}
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ps-name">Guest name</Label>
            <Input id="ps-name" value={d.guestName} onChange={(e) => setD({ ...d, guestName: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ps-mobile">Mobile (optional)</Label>
            <Input id="ps-mobile" inputMode="tel" value={d.guestMobile} onChange={(e) => setD({ ...d, guestMobile: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ps-type">Type</Label>
            <NativeSelect id="ps-type" value={d.type} onChange={(e) => setD({ ...d, type: e.target.value })}>
              {VISITOR_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ps-from">From</Label>
            <Input id="ps-from" type="datetime-local" value={d.validFrom} onChange={(e) => setD({ ...d, validFrom: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ps-until">Until</Label>
            <Input id="ps-until" type="datetime-local" value={d.validUntil} onChange={(e) => setD({ ...d, validUntil: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ps-uses">Entries allowed</Label>
            <Input id="ps-uses" type="number" min="1" max="50" value={d.maxUses} onChange={(e) => setD({ ...d, maxUses: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ps-notes">Note for security (optional)</Label>
            <Input id="ps-notes" value={d.notes} onChange={(e) => setD({ ...d, notes: e.target.value })} />
          </div>
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy || !d.guestName.trim()}>
            {busy && <Loader2 className="animate-spin" />} Create pass
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PassQr({ pass, flat, onClose }: { pass: Pass; flat: string; onClose: () => void }) {
  const text = `Your gate pass for ${flat}: code ${pass.code}, valid ${fmtDateTime(pass.validFrom)} to ${fmtDateTime(pass.validUntil)}. Show this code to security.`;
  return (
    <Dialog open onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Pass for {pass.guestName}</DialogTitle>
          <DialogDescription>
            {fmtDateTime(pass.validFrom)} – {fmtDateTime(pass.validUntil)} · {pass.maxUses === 1 ? 'one entry' : `${pass.maxUses} entries`}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3 py-2">
          <div className="rounded-md bg-white p-3">
            <QRCodeSVG value={`GATEPASS:${pass.code}`} size={180} level="M" />
          </div>
          <div className="font-mono text-3xl tracking-[0.3em]">{pass.code}</div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => navigator.clipboard?.writeText(text)}>
            Copy message
          </Button>
          <Button asChild>
            <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">
              Share on WhatsApp
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HelpForm({ flats, onClose, onSaved }: { flats: { id: string; label: string }[]; onClose: () => void; onSaved: (text: string) => void }) {
  const [d, setD] = useState({ name: '', mobile: '', category: 'MAID', flatId: flats[0]?.id || '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiClient.post('/visitors/daily-help', d);
      const h = res.data.data;
      onSaved(h.linkedExisting ? `${h.name} is already registered (code ${h.code}) and is now linked to your flat.` : `${h.name} added. Their gate code is ${h.code}.`);
    } catch (err) {
      setError(errText(err, 'Could not add.'));
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add daily help</DialogTitle>
          <DialogDescription>If they already work in another flat here, they keep the same gate code.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="hp-name">Name</Label>
            <Input id="hp-name" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hp-mobile">Mobile</Label>
            <Input id="hp-mobile" inputMode="tel" value={d.mobile} onChange={(e) => setD({ ...d, mobile: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hp-cat">Work</Label>
            <NativeSelect id="hp-cat" value={d.category} onChange={(e) => setD({ ...d, category: e.target.value })}>
              {HELP_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </NativeSelect>
          </div>
          {flats.length > 1 && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="hp-flat">Flat</Label>
              <NativeSelect id="hp-flat" value={d.flatId} onChange={(e) => setD({ ...d, flatId: e.target.value })}>
                {flats.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
          )}
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy || !d.name.trim() || !d.mobile.trim()}>
            {busy && <Loader2 className="animate-spin" />} Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
