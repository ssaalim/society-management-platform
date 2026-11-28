'use client';

import React, { useEffect, useState } from 'react';
import { Check, Copy, Loader2, MessageCircle } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Invite {
  code: string;
  expiresAt: string;
  email: string;
  mobile: string | null;
  name: string | null;
  message: string;
}

/**
 * Makes a one-time code for a member to activate the resident app (or reset a forgotten password), and helps the
 * office send it. Making a new code cancels the previous one.
 */
export function AppInviteDialog({ userId, label, onClose }: { userId: string; label: string; onClose: () => void }) {
  const [invite, setInvite] = useState<Invite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    apiClient
      .post('/auth/invites', { userId })
      .then((res) => setInvite(res.data.data))
      .catch((err) => setError(err?.response?.data?.message || 'Could not make an invite code.'));
  }, [userId]);

  const wa = invite?.mobile ? invite.mobile.replace(/\D/g, '').replace(/^(\d{10})$/, '91$1') : '';
  return (
    <Dialog open onOpenChange={(o: boolean) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite {label} to the app</DialogTitle>
          <DialogDescription>They enter this code in the Housive app (“Have an invite code?”) and choose their own password. It works once and expires in 7 days.</DialogDescription>
        </DialogHeader>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        {!invite && !error && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
        {invite && (
          <div className="space-y-3">
            <div className="rounded-md border bg-muted/40 py-4 text-center font-mono text-3xl font-semibold tracking-[0.3em]">{invite.code}</div>
            <p className="text-xs text-muted-foreground">
              Sign-in email: <b>{invite.email}</b>. Making another code cancels this one. The code also lets them reset a forgotten password.
            </p>
            <p className="whitespace-pre-line rounded-md border p-2 text-xs">{invite.message}</p>
          </div>
        )}
        <DialogFooter className="gap-2">
          {invite && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard?.writeText(invite.message).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  });
                }}
              >
                {copied ? <Check /> : <Copy />} {copied ? 'Copied' : 'Copy message'}
              </Button>
              {wa && (
                <Button asChild>
                  <a href={`https://wa.me/${wa}?text=${encodeURIComponent(invite.message)}`} target="_blank" rel="noreferrer">
                    <MessageCircle /> Send on WhatsApp
                  </a>
                </Button>
              )}
            </>
          )}
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
