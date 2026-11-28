'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Crown, Loader2, Mail, Pencil, Phone, Plus, ShieldAlert, Trash2, UserMinus, Users } from 'lucide-react';
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

const POSTS: { value: string; label: string }[] = [
  { value: 'PRESIDENT', label: 'Chairman / President' },
  { value: 'VICE_PRESIDENT', label: 'Vice-President' },
  { value: 'SECRETARY', label: 'Secretary' },
  { value: 'JOINT_SECRETARY', label: 'Joint Secretary' },
  { value: 'TREASURER', label: 'Treasurer' },
  { value: 'CULTURAL_SECRETARY', label: 'Cultural Secretary' },
  { value: 'COMMITTEE_MEMBER', label: 'Committee Member' },
];

interface Position {
  id: string;
  termId: string;
  memberId: string;
  designation: string;
  designationLabel: string;
  name: string;
  photoUrl: string | null;
  flatLabel: string | null;
  email: string | null;
  mobile: string | null;
  bio: string | null;
  responsibilities: string | null;
  showContact: boolean;
  sortOrder: number;
  startDate: string | null;
  endDate: string | null;
  status: 'ACTIVE' | 'ENDED';
  endReason: string | null;
  isMe: boolean;
}

interface Term {
  id: string;
  name: string;
  startDate: string;
  endDate: string | null;
  electedOn: string | null;
  status: 'DRAFT' | 'CURRENT' | 'PAST';
  notes: string | null;
  activePosts?: number;
}

type TermDetail = Term & { positions: Position[]; canManage: boolean };

interface AccessChange {
  memberId: string;
  name: string;
  fromLabel: string;
  toLabel: string;
  kind: 'gain' | 'lose' | 'change' | 'stay' | 'keep';
}

const errText = (err: any, fallback: string) => {
  const m = err?.response?.data?.message;
  const details = err?.response?.data?.errors;
  if (Array.isArray(details) && details.length) return details.map((d: any) => d.message).join(' ');
  return (Array.isArray(m) ? m.join(' ') : m) || fallback;
};
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
const fmtDate = (d: string | null) =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
const period = (t: Pick<Term, 'startDate' | 'endDate'>) => `${fmtDate(t.startDate)} – ${t.endDate ? fmtDate(t.endDate) : 'present'}`;
const initials = (name: string) =>
  name
    .replace(/\(.*\)/, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

const STATUS_BADGE: Record<Term['status'], { label: string; variant: 'success' | 'warning' | 'muted' }> = {
  CURRENT: { label: 'Current', variant: 'success' },
  DRAFT: { label: 'Draft', variant: 'warning' },
  PAST: { label: 'Past', variant: 'muted' },
};

// ------------------------------------------------------------------------------------------------ main view

export function CommitteeView({ canManage }: { canManage: boolean }) {
  const [current, setCurrent] = useState<TermDetail | null>(null);
  const [terms, setTerms] = useState<Term[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [tab, setTab] = useState('committee');
  const [openTermId, setOpenTermId] = useState<string | null>(null);
  const [termEditor, setTermEditor] = useState<{ term?: Term; fromRoles?: boolean } | null>(null);

  const load = useCallback(async () => {
    try {
      const [c, t] = await Promise.all([apiClient.get('/committee/current'), apiClient.get('/committee/terms')]);
      setCurrent(c.data?.data || null);
      setTerms(t.data?.data || []);
    } catch (err) {
      setNotice({ type: 'error', text: errText(err, 'Could not load the committee.') });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const changed = async (text: string) => {
    setNotice({ type: 'success', text });
    await load();
  };

  const past = terms.filter((t) => t.status === 'PAST');
  const drafts = terms.filter((t) => t.status === 'DRAFT');

  return (
    <div className="space-y-4">
      <PageHeader
        title="Managing Committee"
        description={current ? `${current.name} committee · ${period(current)}` : 'The elected committee that runs the society.'}
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

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="committee">Committee</TabsTrigger>
          <TabsTrigger value="history">History{past.length ? ` (${past.length})` : ''}</TabsTrigger>
          {canManage && <TabsTrigger value="manage">Manage{drafts.length ? ` (${drafts.length} draft)` : ''}</TabsTrigger>}
        </TabsList>

        <TabsContent value="committee">
          {loading ? (
            <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : !current ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                {canManage ? (
                  <>
                    The committee hasn&apos;t been set up yet.{' '}
                    <button type="button" className="text-brand-600 hover:underline" onClick={() => setTab('manage')}>
                      Set it up
                    </button>
                    .
                  </>
                ) : (
                  'The committee details will appear here once the office adds them.'
                )}
              </CardContent>
            </Card>
          ) : (
            <MemberCards term={current} onChanged={changed} />
          )}
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Past committees</CardTitle>
              <CardDescription>Who served, and when.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {past.length === 0 ? (
                <p className="text-sm text-muted-foreground">No past committees recorded yet.</p>
              ) : (
                past.map((t) => <PastTerm key={t.id} term={t} />)
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {canManage && (
          <TabsContent value="manage" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
                <div>
                  <CardTitle className="text-base">Committee terms</CardTitle>
                  <CardDescription>
                    Prepare the next committee as a draft, then make it current at handover. That updates everyone&apos;s app access.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  {terms.length === 0 && (
                    <Button size="sm" variant="outline" onClick={() => setTermEditor({ fromRoles: true })}>
                      <Users /> Start from today&apos;s committee
                    </Button>
                  )}
                  <Button size="sm" onClick={() => setTermEditor({})}>
                    <Plus /> New term
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {terms.length === 0 ? (
                  <p className="p-6 pt-0 text-sm text-muted-foreground">
                    No terms yet. &quot;Start from today&apos;s committee&quot; fills a draft with the people who have committee roles in the app now.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Term</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead>Members</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {terms.map((t) => (
                        <TableRow key={t.id} className="cursor-pointer" onClick={() => setOpenTermId(t.id)}>
                          <TableCell className="font-medium text-brand-700 dark:text-brand-300">{t.name}</TableCell>
                          <TableCell className="text-sm">{period(t)}</TableCell>
                          <TableCell>{t.activePosts ?? 0}</TableCell>
                          <TableCell>
                            <Badge variant={STATUS_BADGE[t.status].variant}>{STATUS_BADGE[t.status].label}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {termEditor && (
        <TermEditor
          term={termEditor.term}
          fromRoles={termEditor.fromRoles}
          onClose={() => setTermEditor(null)}
          onSaved={(id, text) => {
            setTermEditor(null);
            changed(text);
            setOpenTermId(id);
          }}
        />
      )}

      {openTermId && (
        <TermManager
          termId={openTermId}
          onClose={() => setOpenTermId(null)}
          onEditTerm={(t) => setTermEditor({ term: t })}
          onChanged={changed}
          onDeleted={(text) => {
            setOpenTermId(null);
            changed(text);
          }}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ cards

function Avatar({ name, photoUrl, size = 'h-12 w-12' }: { name: string; photoUrl: string | null; size?: string }) {
  return photoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={photoUrl} alt="" className={`${size} shrink-0 rounded-full object-cover`} />
  ) : (
    <div className={`${size} flex shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-300`}>
      {initials(name)}
    </div>
  );
}

function MemberCards({ term, onChanged }: { term: TermDetail; onChanged: (text: string) => void }) {
  const active = term.positions.filter((p) => p.status === 'ACTIVE');
  const [busy, setBusy] = useState<string | null>(null);

  const toggleContact = async (p: Position) => {
    setBusy(p.id);
    try {
      await apiClient.patch(`/committee/positions/${p.id}/contact`, { showContact: !p.showContact });
      onChanged(p.showContact ? 'Your phone and email are now hidden from residents.' : 'Residents can now see your phone and email.');
    } finally {
      setBusy(null);
    }
  };

  if (!active.length) return <p className="text-sm text-muted-foreground">No members in this committee yet.</p>;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {active.map((p) => (
        <Card key={p.id}>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-start gap-3">
              <Avatar name={p.name} photoUrl={p.photoUrl} />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-brand-700 dark:text-brand-300">
                  {p.designation === 'PRESIDENT' && <Crown className="h-3.5 w-3.5" />}
                  {p.designationLabel}
                </div>
                <div className="truncate font-medium">{p.name}</div>
                {p.flatLabel && <div className="text-xs text-muted-foreground">{p.flatLabel}</div>}
              </div>
            </div>
            {p.responsibilities && (
              <div className="text-sm">
                <span className="text-muted-foreground">Looks after: </span>
                {p.responsibilities}
              </div>
            )}
            {p.bio && <p className="text-sm text-muted-foreground">{p.bio}</p>}
            {(p.mobile || p.email) && (
              <div className="space-y-1 text-sm">
                {p.mobile && (
                  <a href={`tel:${p.mobile}`} className="flex items-center gap-1.5 text-brand-700 hover:underline dark:text-brand-300">
                    <Phone className="h-3.5 w-3.5" /> {p.mobile}
                  </a>
                )}
                {p.email && (
                  <a href={`mailto:${p.email}`} className="flex items-center gap-1.5 truncate text-brand-700 hover:underline dark:text-brand-300">
                    <Mail className="h-3.5 w-3.5" /> {p.email}
                  </a>
                )}
              </div>
            )}
            {p.isMe && (
              <label className="flex items-center gap-2 border-t pt-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={p.showContact} disabled={busy === p.id} onChange={() => toggleContact(p)} />
                Show my phone and email to residents
              </label>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function PastTerm({ term }: { term: Term }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<TermDetail | null>(null);
  const toggle = async () => {
    setOpen((o) => !o);
    if (!detail) {
      try {
        const res = await apiClient.get(`/committee/terms/${term.id}`);
        setDetail(res.data.data);
      } catch {
        setDetail(null);
      }
    }
  };
  return (
    <div className="rounded-md border">
      <button type="button" className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left" onClick={toggle} aria-expanded={open}>
        <span>
          <span className="font-medium">{term.name}</span>
          <span className="ml-2 text-sm text-muted-foreground">{period(term)}</span>
        </span>
        <span className="text-xs text-muted-foreground">{term.activePosts ?? 0} members</span>
      </button>
      {open && (
        <div className="border-t px-3 py-2">
          {!detail ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <ul className="space-y-1 text-sm">
              {detail.positions.map((p) => (
                <li key={p.id} className="flex flex-wrap justify-between gap-2">
                  <span>
                    <span className="text-muted-foreground">{p.designationLabel}:</span> {p.name}
                  </span>
                  {p.endReason && p.endReason !== 'Term ended' && (
                    <span className="text-xs text-muted-foreground">
                      left {fmtDate(p.endDate)} ({p.endReason})
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ manage a term

function TermManager({
  termId,
  onClose,
  onEditTerm,
  onChanged,
  onDeleted,
}: {
  termId: string;
  onClose: () => void;
  onEditTerm: (t: Term) => void;
  onChanged: (text: string) => void;
  onDeleted: (text: string) => void;
}) {
  const [term, setTerm] = useState<TermDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [postEditor, setPostEditor] = useState<{ position?: Position } | null>(null);
  const [ending, setEnding] = useState<Position | null>(null);
  const [handover, setHandover] = useState(false);

  const reload = useCallback(async () => {
    try {
      const res = await apiClient.get(`/committee/terms/${termId}`);
      setTerm(res.data.data);
    } catch (err) {
      setError(errText(err, 'Could not load this term.'));
    }
  }, [termId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const afterChange = async (text: string) => {
    await reload();
    onChanged(text);
  };

  const remove = async () => {
    if (!term || !window.confirm(`Delete the draft ${term.name} committee?`)) return;
    setBusy(true);
    try {
      await apiClient.delete(`/committee/terms/${term.id}`);
      onDeleted(`Draft ${term.name} deleted.`);
    } catch (err) {
      setError(errText(err, 'Could not delete.'));
      setBusy(false);
    }
  };

  const editable = term && term.status !== 'PAST';
  const active = term?.positions.filter((p) => p.status === 'ACTIVE') || [];
  const ended = term?.positions.filter((p) => p.status === 'ENDED') || [];

  return (
    <Dialog open onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {term ? `${term.name} committee` : 'Committee term'}
            {term && <Badge variant={STATUS_BADGE[term.status].variant}>{STATUS_BADGE[term.status].label}</Badge>}
          </DialogTitle>
          <DialogDescription>
            {term ? `${period(term)}${term.electedOn ? ` · elected ${fmtDate(term.electedOn)}` : ''}` : 'Loading…'}
            {term?.status === 'CURRENT' && ' · changes here update app access straight away.'}
          </DialogDescription>
        </DialogHeader>

        {term && (
          <div className="space-y-3">
            {active.length === 0 ? (
              <p className="text-sm text-muted-foreground">No posts yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Post</TableHead>
                      <TableHead>Member</TableHead>
                      <TableHead>Looks after</TableHead>
                      <TableHead className="w-20" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {active.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="whitespace-nowrap">{p.designationLabel}</TableCell>
                        <TableCell>
                          <div>{p.name}</div>
                          {p.flatLabel && <div className="text-xs text-muted-foreground">{p.flatLabel}</div>}
                        </TableCell>
                        <TableCell className="max-w-[16rem] truncate text-sm text-muted-foreground">{p.responsibilities || '—'}</TableCell>
                        <TableCell className="whitespace-nowrap text-right">
                          {editable && (
                            <>
                              <Button variant="ghost" size="icon-sm" aria-label={`Edit ${p.name}`} onClick={() => setPostEditor({ position: p })}>
                                <Pencil />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={term.status === 'DRAFT' ? `Remove ${p.name}` : `End ${p.name}'s post`}
                                onClick={() => setEnding(p)}
                              >
                                {term.status === 'DRAFT' ? <Trash2 /> : <UserMinus />}
                              </Button>
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {ended.length > 0 && (
              <div className="text-xs text-muted-foreground">
                Left during the term:{' '}
                {ended.map((p) => `${p.name} (${p.designationLabel}, ${fmtDate(p.endDate)}${p.endReason ? `: ${p.endReason}` : ''})`).join('; ')}
              </div>
            )}
            {term.notes && <p className="text-sm text-muted-foreground">{term.notes}</p>}
          </div>
        )}

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <DialogFooter className="flex-wrap gap-2">
          {term?.status === 'DRAFT' && (
            <Button variant="ghost" className="mr-auto text-red-600" disabled={busy} onClick={remove}>
              <Trash2 /> Delete draft
            </Button>
          )}
          {editable && (
            <>
              <Button variant="outline" disabled={busy} onClick={() => term && onEditTerm(term)}>
                Edit dates
              </Button>
              <Button variant="outline" disabled={busy} onClick={() => setPostEditor({})}>
                <Plus /> Add post
              </Button>
            </>
          )}
          {term?.status === 'DRAFT' && (
            <Button disabled={busy || active.length === 0} onClick={() => setHandover(true)}>
              Make current <ArrowRight />
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>

        {postEditor && term && (
          <PostEditor
            term={term}
            position={postEditor.position}
            onClose={() => setPostEditor(null)}
            onSaved={(text) => {
              setPostEditor(null);
              afterChange(text);
            }}
          />
        )}
        {ending && term && (
          <EndPost
            position={ending}
            draft={term.status === 'DRAFT'}
            onClose={() => setEnding(null)}
            onDone={(text) => {
              setEnding(null);
              afterChange(text);
            }}
          />
        )}
        {handover && term && (
          <Handover
            term={term}
            onClose={() => setHandover(false)}
            onDone={(text) => {
              setHandover(false);
              afterChange(text);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function TermEditor({ term, fromRoles, onClose, onSaved }: { term?: Term; fromRoles?: boolean; onClose: () => void; onSaved: (id: string, text: string) => void }) {
  const year = Number(today().slice(0, 4));
  const [d, setD] = useState({
    name: term?.name || `${year}-${String(year + 1).slice(2)}`,
    startDate: term?.startDate || today(),
    endDate: term?.endDate || '',
    electedOn: term?.electedOn || '',
    notes: term?.notes || '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    const body = { ...d, endDate: d.endDate || null, electedOn: d.electedOn || null, notes: d.notes.trim() || null };
    try {
      const res = term
        ? await apiClient.patch(`/committee/terms/${term.id}`, body)
        : await apiClient.post(fromRoles ? '/committee/terms/from-current-roles' : '/committee/terms', body);
      onSaved(res.data.data.id, term ? 'Term updated.' : `Draft ${d.name} committee created. Check the posts, then make it current.`);
    } catch (err) {
      setError(errText(err, 'Could not save.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{term ? `Edit ${term.name}` : fromRoles ? "Start from today's committee" : 'New committee term'}</DialogTitle>
          <DialogDescription>
            {fromRoles
              ? 'A draft is filled with everyone who has a committee role in the app now. Nothing changes until you make it current.'
              : 'Usually one term per election.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="term-name">Name</Label>
            <Input id="term-name" value={d.name} placeholder="e.g. 2026-27" onChange={(e) => setD({ ...d, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="term-start">From</Label>
            <Input id="term-start" type="date" value={d.startDate} onChange={(e) => setD({ ...d, startDate: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="term-end">To (optional)</Label>
            <Input id="term-end" type="date" value={d.endDate} onChange={(e) => setD({ ...d, endDate: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="term-elected">Elected on (optional)</Label>
            <Input id="term-elected" type="date" value={d.electedOn} onChange={(e) => setD({ ...d, electedOn: e.target.value })} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="term-notes">Notes (optional)</Label>
            <Textarea id="term-notes" rows={2} value={d.notes} placeholder="e.g. Elected at the AGM, returning officer ..." onChange={(e) => setD({ ...d, notes: e.target.value })} />
          </div>
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy || !d.name.trim() || !d.startDate}>
            {busy && <Loader2 className="animate-spin" />} {term ? 'Save' : 'Create draft'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PostEditor({ term, position, onClose, onSaved }: { term: TermDetail; position?: Position; onClose: () => void; onSaved: (text: string) => void }) {
  const [eligible, setEligible] = useState<{ id: string; name: string; role: string | null }[]>([]);
  const taken = new Set(term.positions.filter((p) => p.status === 'ACTIVE' && p.id !== position?.id).map((p) => p.memberId));
  const singleTaken = new Set(
    term.positions.filter((p) => p.status === 'ACTIVE' && p.id !== position?.id && p.designation !== 'COMMITTEE_MEMBER').map((p) => p.designation),
  );
  const [d, setD] = useState({
    memberId: position?.memberId || '',
    designation: position?.designation || POSTS.find((p) => !singleTaken.has(p.value))?.value || 'COMMITTEE_MEMBER',
    responsibilities: position?.responsibilities || '',
    bio: position?.bio || '',
    showContact: position?.showContact ?? false,
    sortOrder: position?.sortOrder ?? 0,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get('/committee/eligible-members')
      .then((res) => setEligible(res.data?.data || []))
      .catch(() => setEligible([]));
  }, []);

  const save = async () => {
    setBusy(true);
    setError(null);
    const body = { ...d, responsibilities: d.responsibilities.trim() || null, bio: d.bio.trim() || null, startDate: null };
    try {
      if (position) await apiClient.patch(`/committee/positions/${position.id}`, body);
      else await apiClient.post(`/committee/terms/${term.id}/positions`, body);
      onSaved(position ? 'Post updated.' : 'Post added.');
    } catch (err) {
      setError(errText(err, 'Could not save.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{position ? `Edit ${position.name}` : 'Add a post'}</DialogTitle>
          <DialogDescription>
            {term.status === 'CURRENT' ? 'This committee is current, so their app access changes as soon as you save.' : 'Nothing changes until the term is made current.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="post-member">Member</Label>
            <NativeSelect id="post-member" value={d.memberId} disabled={!!position} onChange={(e) => setD({ ...d, memberId: e.target.value })}>
              <option value="">Choose a member…</option>
              {eligible.map((m) => (
                <option key={m.id} value={m.id} disabled={taken.has(m.id)}>
                  {m.name}
                  {taken.has(m.id) ? ' (already on this committee)' : ''}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="post-designation">Post</Label>
            <NativeSelect id="post-designation" value={d.designation} onChange={(e) => setD({ ...d, designation: e.target.value })}>
              {POSTS.map((p) => (
                <option key={p.value} value={p.value} disabled={singleTaken.has(p.value)}>
                  {p.label}
                  {singleTaken.has(p.value) ? ' (filled)' : ''}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="post-resp">Looks after (optional)</Label>
            <Input id="post-resp" value={d.responsibilities} placeholder="e.g. Water supply, lifts, security" onChange={(e) => setD({ ...d, responsibilities: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="post-bio">Short bio (optional)</Label>
            <Textarea id="post-bio" rows={2} value={d.bio} onChange={(e) => setD({ ...d, bio: e.target.value })} />
          </div>
          <label className="flex items-start gap-2.5 text-sm">
            <input type="checkbox" className="mt-0.5" checked={d.showContact} onChange={(e) => setD({ ...d, showContact: e.target.checked })} />
            <span>
              Show their phone and email to residents
              <span className="block text-xs text-muted-foreground">Only with the member&apos;s consent; they can change it themselves.</span>
            </span>
          </label>
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy || !d.memberId}>
            {busy && <Loader2 className="animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EndPost({ position, draft, onClose, onDone }: { position: Position; draft: boolean; onClose: () => void; onDone: (text: string) => void }) {
  const [endDate, setEndDate] = useState(today());
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiClient.post(`/committee/positions/${position.id}/end`, { endDate, reason: reason.trim() || null });
      onDone(draft ? `${position.name} removed from the draft.` : `${position.name}'s post as ${position.designationLabel} has ended.`);
    } catch (err) {
      setError(errText(err, 'Could not save.'));
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{draft ? `Remove ${position.name}?` : `End ${position.name}'s post`}</DialogTitle>
          <DialogDescription>
            {draft
              ? 'They are only removed from this draft.'
              : `For a resignation or removal mid-term. Their committee access ends now; the post stays in the history.`}
          </DialogDescription>
        </DialogHeader>
        {!draft && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="end-date">Last day</Label>
              <Input id="end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end-reason">Reason (optional)</Label>
              <Input id="end-reason" value={reason} placeholder="e.g. Resigned" onChange={(e) => setReason(e.target.value)} />
            </div>
          </div>
        )}
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={submit} disabled={busy}>
            {busy && <Loader2 className="animate-spin" />} {draft ? 'Remove' : 'End post'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const CHANGE_STYLE: Record<AccessChange['kind'], { label: string; variant: 'success' | 'danger' | 'info' | 'muted' }> = {
  gain: { label: 'Joins', variant: 'success' },
  change: { label: 'Changes', variant: 'info' },
  lose: { label: 'Leaves', variant: 'danger' },
  stay: { label: 'No change', variant: 'muted' },
  keep: { label: 'Staff role kept', variant: 'muted' },
};

function Handover({ term, onClose, onDone }: { term: TermDetail; onClose: () => void; onDone: (text: string) => void }) {
  const [preview, setPreview] = useState<{ changes: AccessChange[]; problems: string[]; youLoseAccess: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get(`/committee/terms/${term.id}/handover-preview`)
      .then((res) => setPreview(res.data.data))
      .catch((err) => setError(errText(err, 'Could not prepare the handover.')));
  }, [term.id]);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiClient.post(`/committee/terms/${term.id}/make-current`);
      if (preview?.youLoseAccess) {
        window.location.reload();
        return;
      }
      onDone(`The ${term.name} committee is now current. App access has been updated.`);
    } catch (err) {
      setError(errText(err, 'The handover did not go through.'));
      setBusy(false);
    }
  };

  const real = preview?.changes || [];

  return (
    <Dialog open onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Make {term.name} the current committee?</DialogTitle>
          <DialogDescription>The current committee moves to history, and app access changes as below.</DialogDescription>
        </DialogHeader>
        {!preview ? (
          !error && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <div className="space-y-3">
            {preview.problems.length > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                {preview.problems.join(' ')}
              </div>
            )}
            {real.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nobody&apos;s access changes.</p>
            ) : (
              <ul className="divide-y rounded-md border text-sm">
                {real.map((c) => (
                  <li key={c.memberId} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <span className="font-medium">{c.name}</span>
                    <span className="flex items-center gap-2">
                      <Badge variant={CHANGE_STYLE[c.kind].variant}>{CHANGE_STYLE[c.kind].label}</Badge>
                      {c.kind === 'keep' || c.kind === 'stay' ? (
                        <span className="text-muted-foreground">stays {c.fromLabel}</span>
                      ) : (
                        <span className="text-muted-foreground">
                          {c.fromLabel} → <span className="text-foreground">{c.toLabel}</span>
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {preview.youLoseAccess && (
              <div className="flex gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                You are not on the new committee, so you will lose management access after this.
              </div>
            )}
          </div>
        )}
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={confirm} disabled={busy || !preview || preview.problems.length > 0}>
            {busy && <Loader2 className="animate-spin" />} Make current
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
