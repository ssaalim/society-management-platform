'use client';

import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { MEETING_TYPES, errText, toInstant, toLocalInput } from './meeting-utils';

export interface MeetingFields {
  id: string;
  title: string;
  type: string;
  audience: 'ALL_MEMBERS' | 'COMMITTEE';
  scheduledAt: string;
  location: string;
  description: string | null;
  quorumRequired: number | null;
  allowProxy?: boolean;
  proxyLimit?: number;
  proxiesCountForQuorum?: boolean;
  status: string;
}

/** Create a meeting (as a draft) or change its details. */
export function MeetingEditor({ meeting, onClose, onSaved }: { meeting?: MeetingFields; onClose: () => void; onSaved: (id: string) => void }) {
  const [d, setD] = useState({
    title: meeting?.title || '',
    type: meeting?.type || 'COMMITTEE',
    audience: meeting?.audience || 'COMMITTEE',
    scheduledAt: toLocalInput(meeting?.scheduledAt || null),
    location: meeting?.location || '',
    description: meeting?.description || '',
    quorumRequired: meeting?.quorumRequired ? String(meeting.quorumRequired) : '',
    allowProxy: meeting?.allowProxy ?? false,
    proxyLimit: String(meeting?.proxyLimit ?? 1),
    proxiesCountForQuorum: meeting?.proxiesCountForQuorum ?? false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<typeof d>) => setD((x) => ({ ...x, ...patch }));

  const pickType = (type: string) => set({ type, audience: type === 'COMMITTEE' ? 'COMMITTEE' : 'ALL_MEMBERS', title: d.title || (MEETING_TYPES.find((t) => t.value === type)?.label ?? '') });

  const save = async () => {
    setBusy(true);
    setError(null);
    const body = {
      ...d,
      scheduledAt: toInstant(d.scheduledAt),
      description: d.description.trim() || null,
      quorumRequired: d.quorumRequired ? Number(d.quorumRequired) : null,
      proxyLimit: Number(d.proxyLimit) || 1,
    };
    try {
      const res = meeting ? await apiClient.patch(`/meetings/${meeting.id}`, body) : await apiClient.post('/meetings', body);
      onSaved(res.data.data.id);
    } catch (err) {
      setError(errText(err, 'Could not save.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{meeting ? 'Edit meeting' : 'New meeting'}</DialogTitle>
          <DialogDescription>
            {meeting?.status === 'SCHEDULED'
              ? 'Invitees are told if the time or place changes.'
              : 'Saved as a draft. Add the agenda, then send the notice.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="mt-type">Type</Label>
            <NativeSelect id="mt-type" value={d.type} onChange={(e) => pickType(e.target.value)}>
              {MEETING_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mt-audience">Invite</Label>
            <NativeSelect id="mt-audience" value={d.audience} onChange={(e) => set({ audience: e.target.value as 'ALL_MEMBERS' | 'COMMITTEE' })}>
              <option value="ALL_MEMBERS">All members</option>
              <option value="COMMITTEE">Managing committee only</option>
            </NativeSelect>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="mt-title">Title</Label>
            <Input id="mt-title" value={d.title} onChange={(e) => set({ title: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mt-when">Date and time</Label>
            <Input id="mt-when" type="datetime-local" value={d.scheduledAt} onChange={(e) => set({ scheduledAt: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mt-where">Place</Label>
            <Input id="mt-where" value={d.location} placeholder="e.g. Clubhouse, or a video link" onChange={(e) => set({ location: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mt-quorum">Quorum (people present)</Label>
            <Input id="mt-quorum" type="number" min="1" value={d.quorumRequired} placeholder="Optional" onChange={(e) => set({ quorumRequired: e.target.value })} />
          </div>
          <div className="space-y-2 rounded-md border p-3 sm:col-span-2">
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-0.5" checked={d.allowProxy} onChange={(e) => set({ allowProxy: e.target.checked })} />
              <span>
                Allow proxies
                <span className="block text-xs text-muted-foreground">Members can appoint someone to attend (and vote on resolutions) for them. Check your bye-laws first.</span>
              </span>
            </label>
            {d.allowProxy && (
              <div className="grid gap-3 pl-6 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="mt-proxy-limit">Most members one person can represent</Label>
                  <Input id="mt-proxy-limit" type="number" min="1" max="20" value={d.proxyLimit} onChange={(e) => set({ proxyLimit: e.target.value })} />
                </div>
                <label className="flex items-start gap-2 self-end text-sm">
                  <input type="checkbox" className="mt-0.5" checked={d.proxiesCountForQuorum} onChange={(e) => set({ proxiesCountForQuorum: e.target.checked })} />
                  <span>Members present by proxy count towards quorum</span>
                </label>
              </div>
            )}
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="mt-desc">Notice text (optional)</Label>
            <Textarea id="mt-desc" rows={3} value={d.description} placeholder="Anything members should know or bring" onChange={(e) => set({ description: e.target.value })} />
          </div>
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy || !d.title.trim() || !d.scheduledAt || !d.location.trim()}>
            {busy && <Loader2 className="animate-spin" />} {meeting ? 'Save' : 'Create draft'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
