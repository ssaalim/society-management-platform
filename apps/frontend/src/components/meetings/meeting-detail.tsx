'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Ban, CalendarClock, CheckCircle2, FileText, Loader2, MapPin, Megaphone, Pencil, Plus, Printer, Trash2, Users } from 'lucide-react';
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
import { MeetingEditor } from './meeting-editor';
import { ResolutionsPanel } from './resolutions-panel';
import { ProxyCard, ProxyDialog } from './meeting-proxies';
import { MinutesDocument, NoticeDocument } from './meeting-documents';
import { MeetingStatus, MeetingStatusBadge, Notice, Rsvp, RSVP_LABEL, errText, fmtDate, fmtWhen } from './meeting-utils';

interface AgendaItem {
  id: string;
  position: number;
  title: string;
  description: string | null;
  presenter: string | null;
}

interface ActionItem {
  id: string;
  title: string;
  ownerUserId: string | null;
  ownerName: string | null;
  dueDate: string | null;
  status: 'OPEN' | 'IN_PROGRESS' | 'DONE';
  notes: string | null;
  resolutionId: string | null;
  resolutionNumber: number | null;
}

export interface MeetingDetailData {
  id: string;
  title: string;
  type: string;
  typeLabel: string;
  audience: 'ALL_MEMBERS' | 'COMMITTEE';
  scheduledAt: string;
  location: string;
  description: string | null;
  quorumRequired: number | null;
  allowProxy: boolean;
  proxyLimit: number;
  proxiesCountForQuorum: boolean;
  canAppointProxy: boolean;
  myProxy: { id: string; proxyUserId: string | null; name: string; recordedBySecretary: boolean } | null;
  proxyFor: { memberUserId: string; name: string }[];
  presentInPerson: number;
  presentByProxy: number;
  attendees: { name: string; viaProxy: string | null }[] | null;
  signatories: { secretary: string | null; chairman: string | null };
  status: MeetingStatus;
  cancelReason: string | null;
  noticeSentAt: string | null;
  agenda: AgendaItem[];
  invitedCount: number;
  invited: boolean;
  canManage: boolean;
  myRsvp: Rsvp | null;
  canRsvp: boolean;
  rsvpCounts: Record<Rsvp, number>;
  presentCount: number;
  quorumMet: boolean | null;
  roll:
    | {
        userId: string;
        name: string;
        rsvp: Rsvp | null;
        present: boolean;
        viaProxy: boolean;
        proxy: { id: string; name: string; recordedBySecretary: boolean } | null;
      }[]
    | null;
  minutes: { content: string; status: 'DRAFT' | 'FINAL'; finalisedAt: string | null } | null;
  minutesStatus: 'DRAFT' | 'FINAL' | null;
  actionItems: ActionItem[];
}

const ACTION_STATUS: Record<ActionItem['status'], { label: string; variant: 'warning' | 'info' | 'success' }> = {
  OPEN: { label: 'Open', variant: 'warning' },
  IN_PROGRESS: { label: 'In progress', variant: 'info' },
  DONE: { label: 'Done', variant: 'success' },
};

export function MeetingDetail({ slug, meetingId, myUserId }: { slug: string; meetingId: string; myUserId: string | null }) {
  const router = useRouter();
  const params = useSearchParams();
  const [m, setM] = useState<MeetingDetailData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState(params.get('tab') || 'overview');
  const [editing, setEditing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [printing, setPrinting] = useState<'notice' | 'minutes' | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get(`/meetings/${meetingId}`);
      setM(res.data.data);
    } catch (err) {
      setError(errText(err, 'Could not load this meeting.'));
    }
  }, [meetingId]);

  useEffect(() => {
    load();
  }, [load]);

  /** Runs an action that returns the updated meeting. */
  const act = async (fn: () => Promise<any>, text: string | ((d: any) => string)) => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fn();
      const data = res?.data?.data;
      if (data && data.id === meetingId && data.agenda) setM(data);
      else await load();
      setNotice({ type: 'success', text: typeof text === 'function' ? text(data) : text });
    } catch (err) {
      setNotice({ type: 'error', text: errText(err, 'That did not work.') });
    } finally {
      setBusy(false);
    }
  };

  if (error) return <Notice notice={{ type: 'error', text: error }} />;
  if (!m)
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );

  const startsIn = new Date(m.scheduledAt).getTime() - Date.now();
  const live = ['SCHEDULED', 'HELD'].includes(m.status);
  const canAttendance = m.canManage && live && startsIn < 3600_000 && m.minutesStatus !== 'FINAL';

  return (
    <div className="space-y-4">
      <PageHeader
        crumbs={[{ label: 'Meetings', href: `/${slug}/meetings` }]}
        title={m.title}
        actions={
          m.canManage && (
            <div className="flex flex-wrap gap-2">
              {m.status === 'DRAFT' && (
                <Button size="sm" disabled={busy} onClick={() => act(() => apiClient.post(`/meetings/${m.id}/notice`), (d) => `Notice sent to ${d?.notified ?? m.invitedCount} people.`)}>
                  <Megaphone /> Send notice
                </Button>
              )}
              {m.status === 'SCHEDULED' && startsIn < 3600_000 && (
                <Button size="sm" disabled={busy} onClick={() => act(() => apiClient.post(`/meetings/${m.id}/held`), 'Marked as held. You can now write the minutes.')}>
                  <CheckCircle2 /> Mark as held
                </Button>
              )}
              {['DRAFT', 'SCHEDULED'].includes(m.status) && (
                <Button size="sm" variant="outline" disabled={busy} onClick={() => setEditing(true)}>
                  <Pencil /> Edit
                </Button>
              )}
              {m.status === 'SCHEDULED' && (
                <Button size="sm" variant="outline" disabled={busy} onClick={() => setCancelling(true)}>
                  <Ban /> Cancel meeting
                </Button>
              )}
              {m.status === 'DRAFT' && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-600"
                  disabled={busy}
                  onClick={async () => {
                    if (!window.confirm('Delete this draft meeting?')) return;
                    try {
                      await apiClient.delete(`/meetings/${m.id}`);
                      router.push(`/${slug}/meetings`);
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

      <div className="flex flex-wrap gap-2">
        {m.status !== 'DRAFT' || m.canManage ? (
          <Button size="sm" variant="outline" onClick={() => setPrinting('notice')}>
            <Printer /> Notice
          </Button>
        ) : null}
        {m.minutes && (
          <Button size="sm" variant="outline" onClick={() => setPrinting('minutes')}>
            <Printer /> Minutes{m.minutes.status === 'DRAFT' ? ' (draft)' : ''}
          </Button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
        <Badge variant="outline">{m.typeLabel}</Badge>
        <MeetingStatusBadge status={m.status} scheduledAt={m.scheduledAt} />
        {m.audience === 'COMMITTEE' && <Badge variant="muted">Committee only</Badge>}
        <span className="flex items-center gap-1.5">
          <CalendarClock className="h-4 w-4" /> {fmtWhen(m.scheduledAt)}
        </span>
        <span className="flex items-center gap-1.5">
          <MapPin className="h-4 w-4" /> {m.location}
        </span>
      </div>

      <Notice notice={notice} />
      {m.status === 'CANCELLED' && (
        <Notice notice={{ type: 'error', text: `This meeting was cancelled.${m.cancelReason ? ` ${m.cancelReason}` : ''}` }} />
      )}
      {m.status === 'DRAFT' && m.canManage && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Only you and the office can see this draft. Add the agenda, then send the notice to the {m.invitedCount} invitees.
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Notice & agenda</TabsTrigger>
          <TabsTrigger value="resolutions">Resolutions</TabsTrigger>
          {m.canManage && <TabsTrigger value="attendance">Attendance</TabsTrigger>}
          <TabsTrigger value="minutes">Minutes</TabsTrigger>
          <TabsTrigger value="actions">Action items{m.actionItems.length ? ` (${m.actionItems.length})` : ''}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {m.status === 'SCHEDULED' && m.invited && (
            <RsvpCard m={m} busy={busy} onReply={(response) => act(() => apiClient.put(`/meetings/${m.id}/rsvp`, { response }), `Reply saved: ${RSVP_LABEL[response]}.`)} />
          )}
          {m.allowProxy && m.invited && m.status !== 'CANCELLED' && (m.canAppointProxy || m.myProxy || m.proxyFor.length > 0) && (
            <ProxyCard meetingId={m.id} info={m} busy={busy} act={act} />
          )}
          {m.description && (
            <Card>
              <CardContent className="whitespace-pre-line p-4 text-sm">{m.description}</CardContent>
            </Card>
          )}
          <AgendaCard m={m} busy={busy} act={act} />
          {m.canManage && m.status !== 'DRAFT' && (
            <p className="text-xs text-muted-foreground">
              {m.invitedCount} invited · {m.rsvpCounts.ATTENDING} attending · {m.rsvpCounts.TENTATIVE} maybe · {m.rsvpCounts.NOT_ATTENDING} not attending
            </p>
          )}
        </TabsContent>

        <TabsContent value="resolutions">
          <ResolutionsPanel meetingId={m.id} meetingStatus={m.status} canManage={m.canManage} agenda={m.agenda} />
        </TabsContent>

        {m.canManage && (
          <TabsContent value="attendance">
            <AttendanceCard m={m} busy={busy} enabled={canAttendance} act={act} />
          </TabsContent>
        )}

        <TabsContent value="minutes">
          <MinutesCard m={m} busy={busy} act={act} />
        </TabsContent>

        <TabsContent value="actions">
          <ActionItemsCard m={m} busy={busy} act={act} myUserId={myUserId} />
        </TabsContent>
      </Tabs>

      {editing && (
        <MeetingEditor
          meeting={m}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            load();
            setNotice({ type: 'success', text: 'Meeting updated.' });
          }}
        />
      )}
      {printing === 'notice' && <NoticeDocument m={m} onClose={() => setPrinting(null)} />}
      {printing === 'minutes' && <MinutesDocument m={m} onClose={() => setPrinting(null)} />}
      {cancelling && (
        <CancelDialog
          onClose={() => setCancelling(false)}
          onConfirm={(reason) => {
            setCancelling(false);
            act(() => apiClient.post(`/meetings/${m.id}/cancel`, { reason }), 'Meeting cancelled. Invitees have been told.');
          }}
        />
      )}
    </div>
  );
}

type Act = (fn: () => Promise<any>, text: string | ((d: any) => string)) => Promise<void>;

// ------------------------------------------------------------------------------------------------ RSVP

function RsvpCard({ m, busy, onReply }: { m: MeetingDetailData; busy: boolean; onReply: (r: Rsvp) => void }) {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="text-sm">
          {m.canRsvp ? (
            <>
              <div className="font-medium">Will you attend?</div>
              <div className="text-muted-foreground">You can change your reply until the meeting starts.</div>
            </>
          ) : (
            <div className="text-muted-foreground">Replies are closed. {m.myRsvp ? `You said: ${RSVP_LABEL[m.myRsvp]}.` : ''}</div>
          )}
        </div>
        {m.canRsvp && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Your reply">
            {(['ATTENDING', 'TENTATIVE', 'NOT_ATTENDING'] as Rsvp[]).map((r) => (
              <Button key={r} size="sm" variant={m.myRsvp === r ? 'default' : 'outline'} aria-pressed={m.myRsvp === r} disabled={busy} onClick={() => onReply(r)}>
                {RSVP_LABEL[r]}
              </Button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------------------------------------------ agenda

function AgendaCard({ m, busy, act }: { m: MeetingDetailData; busy: boolean; act: Act }) {
  const [editing, setEditing] = useState<{ item?: AgendaItem } | null>(null);
  const editable = m.canManage && ['DRAFT', 'SCHEDULED'].includes(m.status);
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">Agenda</CardTitle>
        {editable && (
          <Button size="sm" variant="outline" onClick={() => setEditing({})}>
            <Plus /> Add item
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {m.agenda.length === 0 ? (
          <p className="text-sm text-muted-foreground">No agenda yet.</p>
        ) : (
          <ol className="space-y-2">
            {m.agenda.map((a, i) => (
              <li key={a.id} className="flex items-start justify-between gap-2 rounded-md border p-3">
                <div className="text-sm">
                  <div className="font-medium">
                    {i + 1}. {a.title}
                  </div>
                  {a.presenter && <div className="text-xs text-muted-foreground">Presented by {a.presenter}</div>}
                  {a.description && <div className="mt-1 whitespace-pre-line text-muted-foreground">{a.description}</div>}
                </div>
                {editable && (
                  <div className="flex shrink-0">
                    <Button variant="ghost" size="icon-sm" aria-label={`Edit ${a.title}`} onClick={() => setEditing({ item: a })}>
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${a.title}`}
                      disabled={busy}
                      onClick={() => window.confirm(`Remove "${a.title}" from the agenda?`) && act(() => apiClient.delete(`/meetings/agenda/${a.id}`), 'Agenda item removed.')}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
      {editing && (
        <AgendaEditor
          item={editing.item}
          onClose={() => setEditing(null)}
          onSave={(body) => {
            setEditing(null);
            act(
              () => (editing.item ? apiClient.patch(`/meetings/agenda/${editing.item.id}`, body) : apiClient.post(`/meetings/${m.id}/agenda`, body)),
              editing.item ? 'Agenda item updated.' : 'Agenda item added.',
            );
          }}
        />
      )}
    </Card>
  );
}

function AgendaEditor({ item, onClose, onSave }: { item?: AgendaItem; onClose: () => void; onSave: (body: any) => void }) {
  const [title, setTitle] = useState(item?.title || '');
  const [presenter, setPresenter] = useState(item?.presenter || '');
  const [description, setDescription] = useState(item?.description || '');
  return (
    <Dialog open onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{item ? 'Edit agenda item' : 'Add agenda item'}</DialogTitle>
          <DialogDescription>Shown to invitees with the notice.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="ag-title">Item</Label>
            <Input id="ag-title" value={title} placeholder="e.g. Adopt audited accounts 2025-26" onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ag-presenter">Presented by (optional)</Label>
            <Input id="ag-presenter" value={presenter} onChange={(e) => setPresenter(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ag-desc">Details (optional)</Label>
            <Textarea id="ag-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!title.trim()} onClick={() => onSave({ title, presenter: presenter.trim() || null, description: description.trim() || null })}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------------------------------------------ attendance

function AttendanceCard({ m, busy, enabled, act }: { m: MeetingDetailData; busy: boolean; enabled: boolean; act: Act }) {
  const roll = m.roll || [];
  const [recording, setRecording] = useState<{ userId: string; name: string } | null>(null);
  const mark = (userId: string, name: string, present: boolean, viaProxy = false) =>
    act(
      () => apiClient.put(`/meetings/${m.id}/attendance`, { userId, present, viaProxy }),
      `${name} marked ${present ? (viaProxy ? 'present by proxy' : 'present') : 'absent'}.`,
    );
  const proxyEditable = m.allowProxy && ['SCHEDULED', 'HELD'].includes(m.status) && m.minutesStatus !== 'FINAL';
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <Users className="h-4 w-4" /> Attendance: {m.presentInPerson} in person{m.allowProxy ? `, ${m.presentByProxy} by proxy` : ''}
          {m.quorumRequired != null && (
            <Badge variant={m.quorumMet ? 'success' : 'warning'}>
              {m.quorumMet ? 'Quorum met' : `Quorum: ${m.quorumRequired} needed`}
              {m.allowProxy && ` (${m.proxiesCountForQuorum ? 'proxies count' : 'in person only'})`}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          {enabled
            ? m.allowProxy
              ? 'Tick who is present in person, or by their proxy. Replies are shown for reference.'
              : 'Tick who is actually present. Replies are shown for reference.'
            : m.minutesStatus === 'FINAL'
              ? 'The minutes are final, so attendance is locked.'
              : 'Attendance opens an hour before the meeting.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">In person</TableHead>
                {m.allowProxy && <TableHead className="w-20">By proxy</TableHead>}
                <TableHead>Member</TableHead>
                <TableHead>Reply</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roll.map((p) => (
                <TableRow key={p.userId}>
                  <TableCell>
                    <input
                      type="checkbox"
                      aria-label={`${p.name} present in person`}
                      checked={p.present && !p.viaProxy}
                      disabled={!enabled || busy}
                      onChange={(e) => mark(p.userId, p.name, e.target.checked)}
                    />
                  </TableCell>
                  {m.allowProxy && (
                    <TableCell>
                      <input
                        type="checkbox"
                        aria-label={`${p.name} present by proxy`}
                        checked={p.present && p.viaProxy}
                        disabled={!enabled || busy || !p.proxy}
                        title={p.proxy ? '' : 'No proxy appointed'}
                        onChange={(e) => mark(p.userId, p.name, e.target.checked, true)}
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    <div>{p.name}</div>
                    {m.allowProxy && (
                      <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                        {p.proxy ? (
                          <>
                            Proxy: {p.proxy.name}
                            {p.proxy.recordedBySecretary && ' (paper form)'}
                            {proxyEditable && !p.viaProxy && (
                              <button
                                type="button"
                                className="text-red-600 hover:underline"
                                onClick={() => window.confirm(`Remove ${p.name}'s proxy?`) && act(() => apiClient.delete(`/meetings/proxies/${p.proxy!.id}`), 'Proxy removed.')}
                              >
                                remove
                              </button>
                            )}
                          </>
                        ) : (
                          proxyEditable && (
                            <button type="button" className="text-brand-600 hover:underline" onClick={() => setRecording({ userId: p.userId, name: p.name })}>
                              Record a proxy
                            </button>
                          )
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.rsvp ? RSVP_LABEL[p.rsvp] : 'No reply'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      {recording && (
        <ProxyDialog
          meetingId={m.id}
          title={`Proxy for ${recording.name}`}
          description="Record a proxy the member gave on paper (or by message)."
          withNote
          onClose={() => setRecording(null)}
          onSave={(body) => {
            const target = recording;
            setRecording(null);
            act(() => apiClient.post(`/meetings/${m.id}/proxies`, { memberUserId: target.userId, ...body }), `Proxy recorded for ${target.name}.`);
          }}
        />
      )}
    </Card>
  );
}

// ------------------------------------------------------------------------------------------------ minutes

function MinutesCard({ m, busy, act }: { m: MeetingDetailData; busy: boolean; act: Act }) {
  const [draft, setDraft] = useState(m.minutes?.content ?? '');
  useEffect(() => setDraft(m.minutes?.content ?? ''), [m.minutes?.content]);
  const final = m.minutes?.status === 'FINAL';
  const editable = m.canManage && m.status === 'HELD' && !final;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" /> Minutes of the meeting
            {m.minutes && <Badge variant={final ? 'success' : 'warning'}>{final ? 'Final' : 'Draft'}</Badge>}
          </CardTitle>
          <CardDescription>
            {final
              ? `Finalised ${m.minutes?.finalisedAt ? fmtWhen(m.minutes.finalisedAt) : ''}.`
              : m.canManage
                ? m.status === 'HELD'
                  ? 'Members see the minutes once you finalise them. Finalising locks them.'
                  : 'Mark the meeting as held to write the minutes.'
                : 'The minutes will appear here once the secretary finalises them.'}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {editable ? (
          <>
            <Textarea
              rows={14}
              value={draft}
              aria-label="Minutes"
              placeholder={`Present: ${m.presentCount} members${m.quorumRequired ? ` (quorum ${m.quorumMet ? 'met' : 'not met'})` : ''}.\n\n${m.agenda.map((a, i) => `${i + 1}. ${a.title}\n   Discussion: ...\n   Decision: ...`).join('\n\n')}`}
              onChange={(e) => setDraft(e.target.value)}
            />
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" disabled={busy || draft === (m.minutes?.content ?? '')} onClick={() => act(() => apiClient.put(`/meetings/${m.id}/minutes`, { content: draft }), 'Draft minutes saved.')}>
                Save draft
              </Button>
              <Button
                disabled={busy || !draft.trim()}
                onClick={async () => {
                  if (!window.confirm('Finalise the minutes? They will be shared with the invitees and can no longer be edited.')) return;
                  if (draft !== (m.minutes?.content ?? '')) await apiClient.put(`/meetings/${m.id}/minutes`, { content: draft }).catch(() => null);
                  act(() => apiClient.post(`/meetings/${m.id}/minutes/finalise`), 'Minutes finalised and shared with the invitees.');
                }}
              >
                Finalise & share
              </Button>
            </div>
          </>
        ) : m.minutes ? (
          <div className="whitespace-pre-line text-sm">{m.minutes.content}</div>
        ) : (
          <p className="text-sm text-muted-foreground">No minutes yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------------------------------------------ action items

function ActionItemsCard({ m, busy, act, myUserId }: { m: MeetingDetailData; busy: boolean; act: Act; myUserId: string | null }) {
  const [editing, setEditing] = useState<{ item?: ActionItem } | null>(null);
  const [people, setPeople] = useState<{ userId: string; name: string }[]>([]);
  const [resolutions, setResolutions] = useState<{ id: string; number: number; title: string }[]>([]);

  useEffect(() => {
    if (!m.canManage || !editing) return;
    setPeople(m.roll || []);
    apiClient
      .get(`/meetings/${m.id}/resolutions`)
      .then((res) => setResolutions(res.data?.data || []))
      .catch(() => setResolutions([]));
  }, [m.canManage, m.id, m.roll, editing]);

  const setStatus = (a: ActionItem, status: ActionItem['status']) =>
    act(() => apiClient.patch(`/meetings/action-items/${a.id}/status`, { status }), `"${a.title}" marked ${ACTION_STATUS[status].label.toLowerCase()}.`);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="text-base">Action items</CardTitle>
          <CardDescription>Follow-ups agreed at the meeting, with who does them.</CardDescription>
        </div>
        {m.canManage && m.status !== 'CANCELLED' && (
          <Button size="sm" variant="outline" onClick={() => setEditing({})}>
            <Plus /> Add
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {m.actionItems.length === 0 ? (
          <p className="p-6 pt-0 text-sm text-muted-foreground">No action items.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>What</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {m.actionItems.map((a) => {
                const canUpdate = m.canManage || a.ownerUserId === myUserId;
                return (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="font-medium">{a.title}</div>
                      {a.resolutionNumber && <div className="text-xs text-muted-foreground">From resolution {a.resolutionNumber}</div>}
                      {a.notes && <div className="text-xs text-muted-foreground">{a.notes}</div>}
                    </TableCell>
                    <TableCell className="text-sm">{a.ownerName || '—'}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{fmtDate(a.dueDate)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {canUpdate ? (
                          <NativeSelect
                            aria-label={`Status of ${a.title}`}
                            className="h-8 w-auto py-0 text-xs"
                            value={a.status}
                            disabled={busy}
                            onChange={(e) => setStatus(a, e.target.value as ActionItem['status'])}
                          >
                            <option value="OPEN">Open</option>
                            <option value="IN_PROGRESS">In progress</option>
                            <option value="DONE">Done</option>
                          </NativeSelect>
                        ) : (
                          <Badge variant={ACTION_STATUS[a.status].variant}>{ACTION_STATUS[a.status].label}</Badge>
                        )}
                        {m.canManage && (
                          <Button variant="ghost" size="icon-sm" aria-label={`Edit ${a.title}`} onClick={() => setEditing({ item: a })}>
                            <Pencil />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
      {editing && (
        <ActionEditor
          item={editing.item}
          people={people}
          resolutions={resolutions}
          onClose={() => setEditing(null)}
          onDelete={
            editing.item
              ? () => {
                  const id = editing.item!.id;
                  setEditing(null);
                  act(() => apiClient.delete(`/meetings/action-items/${id}`), 'Action item deleted.');
                }
              : undefined
          }
          onSave={(body) => {
            const item = editing.item;
            setEditing(null);
            act(() => (item ? apiClient.patch(`/meetings/action-items/${item.id}`, body) : apiClient.post(`/meetings/${m.id}/action-items`, body)), item ? 'Action item updated.' : 'Action item added.');
          }}
        />
      )}
    </Card>
  );
}

function ActionEditor({
  item,
  people,
  resolutions,
  onClose,
  onSave,
  onDelete,
}: {
  item?: ActionItem;
  people: { userId: string; name: string }[];
  resolutions: { id: string; number: number; title: string }[];
  onClose: () => void;
  onSave: (body: any) => void;
  onDelete?: () => void;
}) {
  const [d, setD] = useState({
    title: item?.title || '',
    ownerUserId: item?.ownerUserId || '',
    dueDate: item?.dueDate || '',
    status: item?.status || 'OPEN',
    notes: item?.notes || '',
    resolutionId: item?.resolutionId || '',
  });
  return (
    <Dialog open onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{item ? 'Edit action item' : 'Add action item'}</DialogTitle>
          <DialogDescription>The owner is notified and can update its progress.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ai-title">What needs doing</Label>
            <Input id="ai-title" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ai-owner">Owner</Label>
            <NativeSelect id="ai-owner" value={d.ownerUserId} onChange={(e) => setD({ ...d, ownerUserId: e.target.value })}>
              <option value="">Not assigned</option>
              {people.map((p) => (
                <option key={p.userId} value={p.userId}>
                  {p.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ai-due">Due (optional)</Label>
            <Input id="ai-due" type="date" value={d.dueDate} onChange={(e) => setD({ ...d, dueDate: e.target.value })} />
          </div>
          {resolutions.length > 0 && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ai-res">From resolution (optional)</Label>
              <NativeSelect id="ai-res" value={d.resolutionId} onChange={(e) => setD({ ...d, resolutionId: e.target.value })}>
                <option value="">None</option>
                {resolutions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.number}. {r.title}
                  </option>
                ))}
              </NativeSelect>
            </div>
          )}
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ai-notes">Notes (optional)</Label>
            <Input id="ai-notes" value={d.notes} onChange={(e) => setD({ ...d, notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          {onDelete && (
            <Button variant="ghost" className="mr-auto text-red-600" onClick={() => window.confirm('Delete this action item?') && onDelete()}>
              <Trash2 /> Delete
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!d.title.trim()}
            onClick={() =>
              onSave({ ...d, ownerUserId: d.ownerUserId || null, dueDate: d.dueDate || null, notes: d.notes.trim() || null, resolutionId: d.resolutionId || null })
            }
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CancelDialog({ onClose, onConfirm }: { onClose: () => void; onConfirm: (reason: string | null) => void }) {
  const [reason, setReason] = useState('');
  return (
    <Dialog open onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel this meeting?</DialogTitle>
          <DialogDescription>Invitees are told. Any open votes are closed as not passed.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="cancel-reason">Reason (sent to invitees, optional)</Label>
          <Input id="cancel-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Keep meeting
          </Button>
          <Button variant="destructive" onClick={() => onConfirm(reason.trim() || null)}>
            Cancel meeting
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
