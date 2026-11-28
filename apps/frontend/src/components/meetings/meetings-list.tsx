'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarClock, ClipboardList, Loader2, MapPin, Plus, Vote } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { MeetingEditor } from './meeting-editor';
import { MeetingStatus, MeetingStatusBadge, Notice, Rsvp, RSVP_LABEL, errText, fmtDate, fmtWhen } from './meeting-utils';

interface MeetingRow {
  id: string;
  title: string;
  type: string;
  typeLabel: string;
  audience: 'ALL_MEMBERS' | 'COMMITTEE';
  scheduledAt: string;
  location: string;
  status: MeetingStatus;
  myRsvp: Rsvp | null;
  openVotes: number;
  minutesStatus: 'DRAFT' | 'FINAL' | null;
}

interface ActionRow {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  ownerName: string | null;
  meetingId: string;
  meetingTitle: string;
}

export function MeetingsList({ slug, canManage }: { slug: string; canManage: boolean }) {
  const router = useRouter();
  const [rows, setRows] = useState<MeetingRow[]>([]);
  const [actions, setActions] = useState<ActionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const [m, a] = await Promise.all([apiClient.get('/meetings'), apiClient.get('/meetings/action-items/open')]);
      setRows(m.data?.data || []);
      setActions(a.data?.data || []);
    } catch (err) {
      setNotice({ type: 'error', text: errText(err, 'Could not load meetings.') });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const now = Date.now();
  const upcoming = rows.filter((r) => r.status !== 'CANCELLED' && (r.status === 'DRAFT' || (r.status === 'SCHEDULED' && new Date(r.scheduledAt).getTime() > now - 6 * 3600_000))).reverse();
  const past = rows.filter((r) => !upcoming.includes(r));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Meetings"
        description="General body and committee meetings: notices, replies, votes and minutes."
        actions={
          canManage && (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus /> New meeting
            </Button>
          )
        }
      />
      <Notice notice={notice} />

      {loading ? (
        <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          <section className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground">Upcoming</h2>
            {upcoming.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-sm text-muted-foreground">No meetings coming up.</CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {upcoming.map((m) => (
                  <MeetingCard key={m.id} m={m} slug={slug} />
                ))}
              </div>
            )}
          </section>

          {actions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ClipboardList className="h-4 w-4" /> Open action items
                </CardTitle>
                <CardDescription>Follow-ups agreed at meetings{canManage ? '' : ' that are yours'}.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {actions.map((a) => (
                  <Link key={a.id} href={`/${slug}/meetings/${a.meetingId}?tab=actions`} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/50">
                    <span>
                      <span className="font-medium">{a.title}</span>
                      <span className="text-muted-foreground"> · {a.meetingTitle}</span>
                    </span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      {a.ownerName && <span>{a.ownerName}</span>}
                      {a.dueDate && <span>due {fmtDate(a.dueDate)}</span>}
                      <Badge variant={a.status === 'IN_PROGRESS' ? 'info' : 'warning'}>{a.status === 'IN_PROGRESS' ? 'In progress' : 'Open'}</Badge>
                    </span>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}

          <section className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground">Past</h2>
            {past.length === 0 ? (
              <p className="text-sm text-muted-foreground">No past meetings.</p>
            ) : (
              <div className="divide-y rounded-md border bg-card">
                {past.map((m) => (
                  <Link key={m.id} href={`/${slug}/meetings/${m.id}`} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm hover:bg-muted/50">
                    <span>
                      <span className="font-medium text-brand-700 dark:text-brand-300">{m.title}</span>
                      <span className="text-muted-foreground"> · {fmtWhen(m.scheduledAt)}</span>
                    </span>
                    <span className="flex flex-wrap gap-1">
                      <MeetingStatusBadge status={m.status} scheduledAt={m.scheduledAt} />
                      {m.minutesStatus === 'FINAL' && <Badge variant="success">Minutes</Badge>}
                      {m.openVotes > 0 && <Badge variant="warning">Voting open</Badge>}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {creating && (
        <MeetingEditor
          onClose={() => setCreating(false)}
          onSaved={(id) => {
            setCreating(false);
            router.push(`/${slug}/meetings/${id}`);
          }}
        />
      )}
    </div>
  );
}

function MeetingCard({ m, slug }: { m: MeetingRow; slug: string }) {
  return (
    <Link href={`/${slug}/meetings/${m.id}`} className="block">
      <Card className="h-full transition hover:border-brand-300">
        <CardContent className="space-y-2 p-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline">{m.typeLabel}</Badge>
            <MeetingStatusBadge status={m.status} scheduledAt={m.scheduledAt} />
            {m.audience === 'COMMITTEE' && <Badge variant="muted">Committee only</Badge>}
          </div>
          <div className="font-medium">{m.title}</div>
          <div className="space-y-1 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <CalendarClock className="h-3.5 w-3.5" /> {fmtWhen(m.scheduledAt)}
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> {m.location}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 text-xs">
            {m.status === 'SCHEDULED' &&
              (m.myRsvp ? <Badge variant="info">You: {RSVP_LABEL[m.myRsvp]}</Badge> : <Badge variant="warning">Please reply</Badge>)}
            {m.openVotes > 0 && (
              <Badge variant="warning">
                <Vote /> {m.openVotes} vote{m.openVotes === 1 ? '' : 's'} open
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
