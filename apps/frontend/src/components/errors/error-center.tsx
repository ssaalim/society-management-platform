'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AlertTriangle, Check, Copy, Mail, MessageCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ERROR_EVENT, ErrorDetails, crumb, detailsText, installErrorCapture } from '@/lib/diagnostics';

/** Support contact for "send to support" (set per deployment). */
const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || '';
const SUPPORT_WHATSAPP = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || '';

/** Mounted once in the app: installs error capture, records page changes, and shows the error popup. */
export function ErrorCenter() {
  const pathname = usePathname();
  const [current, setCurrent] = useState<ErrorDetails | null>(null);

  useEffect(() => {
    installErrorCapture();
    const onError = (e: Event) => setCurrent((e as CustomEvent<ErrorDetails>).detail);
    window.addEventListener(ERROR_EVENT, onError);
    return () => window.removeEventListener(ERROR_EVENT, onError);
  }, []);

  useEffect(() => {
    if (pathname) crumb(`open ${pathname.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, ':id')}`);
  }, [pathname]);

  if (!current) return null;
  return (
    <Dialog open onOpenChange={(o: boolean) => !o && setCurrent(null)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <ErrorBody d={current} />
        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" onClick={() => location.reload()}>
            <RefreshCw /> Reload page
          </Button>
          <Button onClick={() => setCurrent(null)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The shared content of the popup and the crash page: what happened, what to do, and details for support. */
export function ErrorBody({ d, asPage }: { d: ErrorDetails; asPage?: boolean }) {
  const [copied, setCopied] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const text = detailsText(d);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const t = document.createElement('textarea');
      t.value = text;
      document.body.appendChild(t);
      t.select();
      document.execCommand('copy');
      t.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const Title = asPage ? 'h1' : DialogTitle;
  const Desc = asPage ? 'p' : DialogDescription;
  return (
    <>
      <div className={asPage ? 'space-y-1 text-center' : ''}>
        {asPage ? (
          <span className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            <AlertTriangle className="h-6 w-6" />
          </span>
        ) : null}
        {asPage ? (
          <Title className="text-lg font-semibold">{d.title}</Title>
        ) : (
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" /> {d.title}
            </DialogTitle>
            <DialogDescription>{d.message}</DialogDescription>
          </DialogHeader>
        )}
        {asPage && <Desc className="text-sm text-muted-foreground">{d.message}</Desc>}
      </div>

      {d.help && (
        <div className="space-y-1.5 rounded-md border bg-muted/40 p-3 text-sm">
          <div className="text-muted-foreground">{d.help.cause}</div>
          <ol className="list-decimal space-y-0.5 pl-5">
            {d.help.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </div>
      )}

      <div className="rounded-md border p-3 text-center">
        <div className="text-xs text-muted-foreground">If you contact support, give them this code</div>
        <div className="font-mono text-2xl font-bold tracking-wider">{d.code || '—'}</div>
        <div className="text-xs text-muted-foreground">
          {d.help ? `${d.help.id} · ` : ''}
          {d.requestId ? `Ref ${d.requestId.slice(0, 8)} · ` : ''}
          {d.time}
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <Button size="sm" variant="outline" onClick={copy}>
          {copied ? <Check /> : <Copy />} {copied ? 'Copied' : 'Copy details'}
        </Button>
        <Button size="sm" variant="outline" asChild>
          <a href={`https://wa.me/${SUPPORT_WHATSAPP.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">
            <MessageCircle /> WhatsApp
          </a>
        </Button>
        <Button size="sm" variant="outline" asChild>
          <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Housive error ${d.code || ''}`)}&body=${encodeURIComponent(text)}`}>
            <Mail /> Email
          </a>
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setShowDetails((s) => !s)} aria-expanded={showDetails}>
          {showDetails ? 'Hide' : 'Show'} details
        </Button>
      </div>
      {showDetails && <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-2 text-left text-[11px]">{text}</pre>}
    </>
  );
}
