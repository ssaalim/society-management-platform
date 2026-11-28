'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, UserCheck } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { errText } from './meeting-utils';

type Act = (fn: () => Promise<any>, text: string | ((d: any) => string)) => Promise<void>;

export interface ProxyInfo {
  allowProxy: boolean;
  proxyLimit: number;
  canAppointProxy: boolean;
  myProxy: { id: string; proxyUserId: string | null; name: string; recordedBySecretary: boolean } | null;
  proxyFor: { memberUserId: string; name: string }[];
}

/** A member's proxy for this meeting, and who they represent. */
export function ProxyCard({ meetingId, info, busy, act }: { meetingId: string; info: ProxyInfo; busy: boolean; act: Act }) {
  const [picking, setPicking] = useState(false);
  return (
    <Card>
      <CardContent className="space-y-2 p-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 font-medium">
              <UserCheck className="h-4 w-4" /> Proxy
            </div>
            <div className="text-muted-foreground">
              {info.myProxy
                ? `${info.myProxy.name} will attend${info.myProxy.proxyUserId ? ' and can vote on resolutions' : ''} for you${info.myProxy.recordedBySecretary ? ' (recorded by the secretary)' : ''}.`
                : "Can't attend? Appoint someone to attend for you."}
            </div>
          </div>
          {info.canAppointProxy && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={busy} onClick={() => setPicking(true)}>
                {info.myProxy ? 'Change' : 'Appoint a proxy'}
              </Button>
              {info.myProxy && (
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => act(() => apiClient.delete(`/meetings/${meetingId}/proxy`), 'Proxy withdrawn.')}>
                  Withdraw
                </Button>
              )}
            </div>
          )}
        </div>
        {info.proxyFor.length > 0 && (
          <div className="rounded-md bg-muted/50 p-2 text-xs">
            You are the proxy for {info.proxyFor.map((p) => p.name.replace(/\s*\(.*\)$/, '')).join(', ')}. Their ballots appear next to yours under Resolutions.
          </div>
        )}
      </CardContent>
      {picking && (
        <ProxyDialog
          meetingId={meetingId}
          title="Appoint a proxy"
          description={`Choose another member (they can then vote for you in the app), or write the name of someone else who will attend for you. One person can represent at most ${info.proxyLimit} member${info.proxyLimit === 1 ? '' : 's'}.`}
          onClose={() => setPicking(false)}
          onSave={(body) => {
            setPicking(false);
            act(() => apiClient.put(`/meetings/${meetingId}/proxy`, body), 'Proxy appointed.');
          }}
        />
      )}
    </Card>
  );
}

/** Choose a member (from the meeting's invitees) or type an outside person's name. */
export function ProxyDialog({
  meetingId,
  title,
  description,
  onClose,
  onSave,
  withNote,
}: {
  meetingId: string;
  title: string;
  description: string;
  onClose: () => void;
  onSave: (body: { proxyUserId: string | null; proxyName: string | null; note?: string | null }) => void;
  withNote?: boolean;
}) {
  const [candidates, setCandidates] = useState<{ userId: string; label: string }[] | null>(null);
  const [kind, setKind] = useState<'member' | 'other'>('member');
  const [proxyUserId, setProxyUserId] = useState('');
  const [proxyName, setProxyName] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get(`/meetings/${meetingId}/proxy-candidates`)
      .then((res) => setCandidates(res.data.data))
      .catch((err) => setError(errText(err, 'Could not load members.')));
  }, [meetingId]);

  const ready = kind === 'member' ? !!proxyUserId : !!proxyName.trim();
  return (
    <Dialog open onOpenChange={(o: boolean) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-4 text-sm" role="radiogroup" aria-label="Proxy is">
            <label className="flex items-center gap-1.5">
              <input type="radio" name="proxy-kind" checked={kind === 'member'} onChange={() => setKind('member')} /> A member
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" name="proxy-kind" checked={kind === 'other'} onChange={() => setKind('other')} /> Someone else
            </label>
          </div>
          {kind === 'member' ? (
            <div className="space-y-1.5">
              <Label htmlFor="px-member">Member</Label>
              {!candidates ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <NativeSelect id="px-member" value={proxyUserId} onChange={(e) => setProxyUserId(e.target.value)}>
                  <option value="">Choose…</option>
                  {candidates.map((c) => (
                    <option key={c.userId} value={c.userId}>
                      {c.label}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="px-name">Name</Label>
              <Input id="px-name" value={proxyName} placeholder="e.g. Anjali Singh (spouse)" onChange={(e) => setProxyName(e.target.value)} />
              <p className="text-xs text-muted-foreground">They can attend for you but cannot vote in the app.</p>
            </div>
          )}
          {withNote && (
            <div className="space-y-1.5">
              <Label htmlFor="px-note">Note (optional)</Label>
              <Input id="px-note" value={note} placeholder="e.g. Proxy form received 25 Nov" onChange={(e) => setNote(e.target.value)} />
            </div>
          )}
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!ready}
            onClick={() => onSave({ proxyUserId: kind === 'member' ? proxyUserId : null, proxyName: kind === 'other' ? proxyName.trim() : null, ...(withNote ? { note: note.trim() || null } : {}) })}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
