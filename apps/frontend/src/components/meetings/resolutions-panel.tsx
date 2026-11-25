'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Gavel, Loader2, Pencil, Plus, Timer, Trash2 } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { MeetingStatus, Notice, errText, fmtShort, toInstant, toLocalInput } from './meeting-utils';

type Choice = 'FOR' | 'AGAINST' | 'ABSTAIN';

interface Ballot {
  flatId: string | null;
  onBehalfOf: string | null;
  label: string;
  choice: Choice | null;
  castByMe: boolean;
  castBy: string | null;
  recordedBySecretary: boolean;
  canChange: boolean;
}

interface RollRow {
  key: string;
  flatId: string | null;
  label: string;
  userIds: string[];
  names: string[];
  choice: Choice | null;
  voterName: string | null;
  recordedBy: string | null;
  recordedNote: string | null;
  castByProxy: string | null;
}

interface Resolution {
  id: string;
  number: number;
  title: string;
  body: string | null;
  agendaItemId: string | null;
  proposedBy: string | null;
  secondedBy: string | null;
  voters: 'OWNERS' | 'ALL_MEMBERS' | 'COMMITTEE';
  onePerFlat: boolean;
  threshold: 'SIMPLE' | 'TWO_THIRDS' | 'THREE_QUARTERS';
  thresholdLabel: string;
  status: 'DRAFT' | 'OPEN' | 'CLOSED';
  votingDeadline: string | null;
  result: 'PASSED' | 'FAILED' | null;
  eligibleCount: number;
  votedCount: number;
  deadlinePassed: boolean;
  canVoteNow: boolean;
  myBallots: Ballot[];
  tally: Record<Choice, number> | null;
  projected: 'PASSED' | 'FAILED' | null;
  roll: RollRow[] | null;
}

const CHOICE_LABEL: Record<Choice, string> = { FOR: 'For', AGAINST: 'Against', ABSTAIN: 'Abstain' };
const VOTERS_LABEL: Record<Resolution['voters'], string> = { OWNERS: 'Owners', ALL_MEMBERS: 'All members (owners and tenants)', COMMITTEE: 'Managing committee' };

export function ResolutionsPanel({
  meetingId,
  meetingStatus,
  canManage,
  agenda,
}: {
  meetingId: string;
  meetingStatus: MeetingStatus;
  canManage: boolean;
  agenda: { id: string; title: string }[];
}) {
  const [items, setItems] = useState<Resolution[] | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<{ item?: Resolution } | null>(null);
  const [deadlineFor, setDeadlineFor] = useState<{ r: Resolution; mode: 'open' | 'extend' } | null>(null);
  const [recording, setRecording] = useState<{ r: Resolution; row: RollRow } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get(`/meetings/${meetingId}/resolutions`);
      setItems(res.data?.data || []);
    } catch (err) {
      setNotice({ type: 'error', text: errText(err, 'Could not load resolutions.') });
    }
  }, [meetingId]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (fn: () => Promise<any>, text: string | ((d: any) => string)) => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fn();
      await load();
      setNotice({ type: 'success', text: typeof text === 'function' ? text(res?.data?.data) : text });
    } catch (err) {
      setNotice({ type: 'error', text: errText(err, 'That did not work.') });
    } finally {
      setBusy(false);
    }
  };

  const canDraft = canManage && meetingStatus !== 'CANCELLED';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          A resolution passes when its For votes reach the required majority of votes cast (abstentions are not counted).
        </p>
        {canDraft && (
          <Button size="sm" variant="outline" onClick={() => setEditing({})}>
            <Plus /> Draft resolution
          </Button>
        )}
      </div>
      <Notice notice={notice} />

      {!items ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">No resolutions{canManage ? ' yet' : ' put to the vote yet'}.</CardContent>
        </Card>
      ) : (
        items.map((r) => (
          <ResolutionCard
            key={r.id}
            r={r}
            canManage={canManage}
            busy={busy}
            onVote={(choice, flatId, onBehalfOf) =>
              act(
                () => apiClient.post(`/meetings/resolutions/${r.id}/vote`, { choice, flatId, onBehalfOf }),
                onBehalfOf ? `Vote (${CHOICE_LABEL[choice]}) recorded as proxy.` : `Your vote (${CHOICE_LABEL[choice]}) is recorded. You can change it until the deadline.`,
              )
            }
            onEdit={() => setEditing({ item: r })}
            onDelete={() => window.confirm(`Delete draft resolution ${r.number}?`) && act(() => apiClient.delete(`/meetings/resolutions/${r.id}`), 'Draft resolution deleted.')}
            onOpen={() => setDeadlineFor({ r, mode: 'open' })}
            onExtend={() => setDeadlineFor({ r, mode: 'extend' })}
            onRecord={(row) => setRecording({ r, row })}
            onClose={() =>
              window.confirm(`Close voting on resolution ${r.number} and declare the result?`) &&
              act(() => apiClient.post(`/meetings/resolutions/${r.id}/close`), (d) => `Resolution ${r.number} ${d?.result === 'PASSED' ? 'passed' : 'was not passed'}.`)
            }
          />
        ))
      )}

      {editing && (
        <ResolutionEditor
          item={editing.item}
          agenda={agenda}
          onClose={() => setEditing(null)}
          onSave={(body) => {
            const item = editing.item;
            setEditing(null);
            act(
              () => (item ? apiClient.patch(`/meetings/resolutions/${item.id}`, body) : apiClient.post(`/meetings/${meetingId}/resolutions`, body)),
              item ? 'Resolution updated.' : 'Resolution drafted. Open the vote when ready.',
            );
          }}
        />
      )}
      {deadlineFor && (
        <DeadlineDialog
          r={deadlineFor.r}
          mode={deadlineFor.mode}
          onClose={() => setDeadlineFor(null)}
          onSave={(deadline) => {
            const { r, mode } = deadlineFor;
            setDeadlineFor(null);
            act(
              () => apiClient.post(`/meetings/resolutions/${r.id}/${mode === 'open' ? 'open' : 'extend'}`, { deadline }),
              mode === 'open' ? `Voting is open. ${r.eligibleCount} voters have been told.` : 'Deadline extended. Those who haven’t voted have been told.',
            );
          }}
        />
      )}
      {recording && (
        <RecordVoteDialog
          row={recording.row}
          onClose={() => setRecording(null)}
          onSave={(body) => {
            const { r } = recording;
            setRecording(null);
            act(() => apiClient.post(`/meetings/resolutions/${r.id}/record-vote`, body), 'Vote recorded on the member’s behalf.');
          }}
        />
      )}
    </div>
  );
}

function ResolutionCard({
  r,
  canManage,
  busy,
  onVote,
  onEdit,
  onDelete,
  onOpen,
  onExtend,
  onRecord,
  onClose,
}: {
  r: Resolution;
  canManage: boolean;
  busy: boolean;
  onVote: (c: Choice, flatId: string | null, onBehalfOf: string | null) => void;
  onEdit: () => void;
  onDelete: () => void;
  onOpen: () => void;
  onExtend: () => void;
  onRecord: (row: RollRow) => void;
  onClose: () => void;
}) {
  const [showRoll, setShowRoll] = useState(false);
  const statusBadge =
    r.status === 'DRAFT' ? (
      <Badge variant="warning">Draft</Badge>
    ) : r.status === 'OPEN' ? (
      r.deadlinePassed ? <Badge variant="info">Deadline passed</Badge> : <Badge variant="success">Voting open</Badge>
    ) : r.result === 'PASSED' ? (
      <Badge variant="success">Passed</Badge>
    ) : (
      <Badge variant="danger">Not passed</Badge>
    );

  return (
    <Card>
      <CardHeader className="space-y-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="text-base">
            Resolution {r.number}: {r.title}
          </CardTitle>
          <div className="flex flex-wrap gap-1">{statusBadge}</div>
        </div>
        <CardDescription>
          {VOTERS_LABEL[r.voters]}
          {r.voters !== 'COMMITTEE' && (r.onePerFlat ? ', one vote per flat' : ', one vote each')} · {r.thresholdLabel}
          {r.votingDeadline && ` · ${r.status === 'CLOSED' ? 'voting ended' : 'until'} ${fmtShort(r.votingDeadline)}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {r.body && <p className="whitespace-pre-line text-sm">{r.body}</p>}
        {(r.proposedBy || r.secondedBy) && (
          <p className="text-xs text-muted-foreground">
            {r.proposedBy && `Proposed by ${r.proposedBy}`}
            {r.proposedBy && r.secondedBy && ' · '}
            {r.secondedBy && `seconded by ${r.secondedBy}`}
          </p>
        )}

        {/* My ballots */}
        {r.status !== 'DRAFT' &&
          r.myBallots.map((b) => (
            <div key={`${b.flatId || 'me'}-${b.onBehalfOf || ''}`} className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 p-3 text-sm">
              <div>
                <div className="font-medium">
                  {b.onBehalfOf ? `Vote ${b.label}` : `Your vote${r.myBallots.length > 1 || b.flatId ? ` for ${b.label}` : ''}`}: {b.choice ? CHOICE_LABEL[b.choice] : 'not voted'}
                </div>
                {b.castBy && <div className="text-xs text-muted-foreground">Cast by {b.castBy}{b.recordedBySecretary ? ' (recorded by the secretary)' : ''}.</div>}
                {!b.castBy && b.recordedBySecretary && <div className="text-xs text-muted-foreground">Recorded by the secretary on your confirmation.</div>}
              </div>
              {b.canChange && (
                <div className="flex gap-1.5" role="group" aria-label={`Vote on resolution ${r.number}`}>
                  {(['FOR', 'AGAINST', 'ABSTAIN'] as Choice[]).map((c) => (
                    <Button key={c} size="sm" variant={b.choice === c ? 'default' : 'outline'} aria-pressed={b.choice === c} disabled={busy} onClick={() => onVote(c, b.flatId, b.onBehalfOf)}>
                      {CHOICE_LABEL[c]}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          ))}

        {/* Progress and results */}
        {r.status !== 'DRAFT' && (
          <div className="space-y-1.5 text-sm">
            <div className="text-muted-foreground">
              {r.votedCount} of {r.eligibleCount} voted
            </div>
            {r.tally && (
              <div className="flex flex-wrap gap-2">
                <Badge variant="success">For {r.tally.FOR}</Badge>
                <Badge variant="danger">Against {r.tally.AGAINST}</Badge>
                <Badge variant="muted">Abstain {r.tally.ABSTAIN}</Badge>
                {r.projected && <span className="text-xs text-muted-foreground">So far this would {r.projected === 'PASSED' ? 'pass' : 'not pass'} (visible to the office only).</span>}
              </div>
            )}
          </div>
        )}

        {/* Office actions */}
        {canManage && (
          <div className="flex flex-wrap gap-2 border-t pt-3">
            {r.status === 'DRAFT' && (
              <>
                <Button size="sm" disabled={busy} onClick={onOpen}>
                  <Gavel /> Open voting
                </Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={onEdit}>
                  <Pencil /> Edit
                </Button>
                <Button size="sm" variant="ghost" className="text-red-600" disabled={busy} onClick={onDelete}>
                  <Trash2 /> Delete
                </Button>
              </>
            )}
            {r.status === 'OPEN' && (
              <>
                <Button size="sm" variant="outline" disabled={busy} onClick={onExtend}>
                  <Timer /> Extend deadline
                </Button>
                <Button size="sm" disabled={busy || (!r.deadlinePassed && r.votedCount < r.eligibleCount)} onClick={onClose}>
                  <Gavel /> Close & declare result
                </Button>
              </>
            )}
            {r.roll && r.status !== 'DRAFT' && (
              <Button size="sm" variant="ghost" onClick={() => setShowRoll((s) => !s)} aria-expanded={showRoll}>
                {showRoll ? 'Hide' : 'Show'} who voted
              </Button>
            )}
          </div>
        )}

        {showRoll && r.roll && (
          <div className="divide-y rounded-md border text-sm">
            {r.roll.map((row) => (
              <div key={row.key} className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5">
                <span>
                  {row.label}
                  {(() => {
                    const who = row.voterName || row.names.join(', ');
                    return who && who !== row.label ? <span className="text-muted-foreground"> · {who}</span> : null;
                  })()}
                </span>
                <span className="flex items-center gap-2">
                  {row.choice ? (
                    <Badge variant={row.choice === 'FOR' ? 'success' : row.choice === 'AGAINST' ? 'danger' : 'muted'}>{CHOICE_LABEL[row.choice]}</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">Not voted</span>
                  )}
                  {row.recordedBy && <span className="text-xs text-muted-foreground" title={row.recordedNote || ''}>recorded by {row.recordedBy}</span>}
                  {row.castByProxy && <span className="text-xs text-muted-foreground">by proxy {row.castByProxy.replace(/\s*\(.*\)$/, '')}</span>}
                  {!row.choice && r.status === 'OPEN' && r.deadlinePassed && (
                    <Button size="sm" variant="outline" className="h-7" onClick={() => onRecord(row)}>
                      Record vote
                    </Button>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ResolutionEditor({ item, agenda, onClose, onSave }: { item?: Resolution; agenda: { id: string; title: string }[]; onClose: () => void; onSave: (body: any) => void }) {
  const [d, setD] = useState({
    title: item?.title || '',
    body: item?.body || '',
    agendaItemId: item?.agendaItemId || '',
    proposedBy: item?.proposedBy || '',
    secondedBy: item?.secondedBy || '',
    voters: item?.voters || 'OWNERS',
    onePerFlat: item?.onePerFlat ?? true,
    threshold: item?.threshold || 'SIMPLE',
  });
  return (
    <Dialog open onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{item ? `Edit resolution ${item.number}` : 'Draft a resolution'}</DialogTitle>
          <DialogDescription>Members can see and vote on it once you open voting.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="rs-title">Title</Label>
            <Input id="rs-title" value={d.title} placeholder="e.g. Adopt the audited accounts" onChange={(e) => setD({ ...d, title: e.target.value })} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="rs-body">Wording</Label>
            <Textarea id="rs-body" rows={3} value={d.body} placeholder="Resolved that ..." onChange={(e) => setD({ ...d, body: e.target.value })} />
          </div>
          {agenda.length > 0 && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="rs-agenda">Agenda item (optional)</Label>
              <NativeSelect id="rs-agenda" value={d.agendaItemId} onChange={(e) => setD({ ...d, agendaItemId: e.target.value })}>
                <option value="">None</option>
                {agenda.map((a, i) => (
                  <option key={a.id} value={a.id}>
                    {i + 1}. {a.title}
                  </option>
                ))}
              </NativeSelect>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="rs-prop">Proposed by</Label>
            <Input id="rs-prop" value={d.proposedBy} onChange={(e) => setD({ ...d, proposedBy: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rs-sec">Seconded by</Label>
            <Input id="rs-sec" value={d.secondedBy} onChange={(e) => setD({ ...d, secondedBy: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rs-voters">Who votes</Label>
            <NativeSelect id="rs-voters" value={d.voters} onChange={(e) => setD({ ...d, voters: e.target.value as Resolution['voters'] })}>
              <option value="OWNERS">Owners</option>
              <option value="ALL_MEMBERS">Owners and tenants</option>
              <option value="COMMITTEE">Managing committee</option>
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rs-threshold">Needed to pass</Label>
            <NativeSelect id="rs-threshold" value={d.threshold} onChange={(e) => setD({ ...d, threshold: e.target.value as Resolution['threshold'] })}>
              <option value="SIMPLE">Simple majority</option>
              <option value="TWO_THIRDS">Two-thirds</option>
              <option value="THREE_QUARTERS">Three-quarters</option>
            </NativeSelect>
          </div>
          {d.voters !== 'COMMITTEE' && (
            <label className="flex items-start gap-2.5 text-sm sm:col-span-2">
              <input type="checkbox" className="mt-0.5" checked={d.onePerFlat} onChange={(e) => setD({ ...d, onePerFlat: e.target.checked })} />
              <span>
                One vote per flat
                <span className="block text-xs text-muted-foreground">Co-owners share one vote; the first to vote decides it.</span>
              </span>
            </label>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!d.title.trim()}
            onClick={() =>
              onSave({
                ...d,
                body: d.body.trim() || null,
                agendaItemId: d.agendaItemId || null,
                proposedBy: d.proposedBy.trim() || null,
                secondedBy: d.secondedBy.trim() || null,
              })
            }
          >
            Save draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeadlineDialog({ r, mode, onClose, onSave }: { r: Resolution; mode: 'open' | 'extend'; onClose: () => void; onSave: (deadline: string) => void }) {
  const base = mode === 'extend' && r.votingDeadline ? new Date(Math.max(new Date(r.votingDeadline).getTime(), Date.now())) : new Date();
  const [value, setValue] = useState(toLocalInput(new Date(base.getTime() + 3 * 86400_000).toISOString()));
  return (
    <Dialog open onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'open' ? `Open voting on resolution ${r.number}` : `Extend voting on resolution ${r.number}`}</DialogTitle>
          <DialogDescription>
            {mode === 'open'
              ? `${r.eligibleCount} eligible voters are told. They can change their vote until the deadline.`
              : 'Those who have not voted yet are told about the new deadline.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="dl">Voting closes at</Label>
          <Input id="dl" type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!value} onClick={() => onSave(toInstant(value))}>
            {mode === 'open' ? 'Open voting' : 'Extend'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RecordVoteDialog({ row, onClose, onSave }: { row: RollRow; onClose: () => void; onSave: (body: any) => void }) {
  const [userId, setUserId] = useState(row.userIds[0]);
  const [choice, setChoice] = useState<Choice>('FOR');
  const [note, setNote] = useState('');
  return (
    <Dialog open onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record a vote for {row.label}</DialogTitle>
          <DialogDescription>Only when the member has confirmed their vote to you. It is marked as recorded by you.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          {row.userIds.length > 1 && (
            <div className="space-y-1.5">
              <Label htmlFor="rv-user">Member who confirmed</Label>
              <NativeSelect id="rv-user" value={userId} onChange={(e) => setUserId(e.target.value)}>
                {row.userIds.map((u, i) => (
                  <option key={u} value={u}>
                    {row.names[i] || `Member ${i + 1}`}
                  </option>
                ))}
              </NativeSelect>
            </div>
          )}
          <div className="flex gap-1.5" role="group" aria-label="Vote">
            {(['FOR', 'AGAINST', 'ABSTAIN'] as Choice[]).map((c) => (
              <Button key={c} size="sm" variant={choice === c ? 'default' : 'outline'} aria-pressed={choice === c} onClick={() => setChoice(c)}>
                {CHOICE_LABEL[c]}
              </Button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rv-note">How they confirmed</Label>
            <Input id="rv-note" value={note} placeholder="e.g. Phoned on 26 Nov, 10 am" onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!note.trim()} onClick={() => onSave({ userId, flatId: row.flatId, choice, note: note.trim() })}>
            Record vote
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
