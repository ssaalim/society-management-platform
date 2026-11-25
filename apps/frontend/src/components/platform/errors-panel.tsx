'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, RotateCcw, Search } from 'lucide-react';
import { platformClient } from '@/lib/api/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Sample {
  at: string;
  requestId: string | null;
  userId: string | null;
  societyId: string | null;
  page: string | null;
  version: string | null;
  userAgent: string | null;
  steps: string[];
  context: unknown;
}

interface ErrorRow {
  code: string;
  source: 'SERVER' | 'CLIENT';
  level: string;
  knownProblem: string | null;
  help: { id: string; title: string } | null;
  message: string;
  where: string | null;
  stack: string | null;
  count: number;
  samples: Sample[];
  firstSeen: string;
  lastSeen: string;
  resolvedAt: string | null;
}

const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/** Errors grouped by code: look up the code a user reports, see who hit it and the steps before it, mark it fixed. */
export function ErrorsPanel() {
  const [rows, setRows] = useState<ErrorRow[] | null>(null);
  const [search, setSearch] = useState('');
  const [openOnly, setOpenOnly] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await platformClient.get('/superadmin/errors', { params: { open: openOnly, search: search || undefined } });
    setRows(res.data.data);
  }, [openOnly, search]);

  useEffect(() => {
    load().catch(() => setRows([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openOnly]);

  const resolve = async (code: string, resolved: boolean) => {
    await platformClient.patch(`/superadmin/errors/${code}`, { resolved });
    await load();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            load();
          }}
        >
          <Input aria-label="Search errors" placeholder="Code (E-1A2B), reference or message" value={search} onChange={(e) => setSearch(e.target.value)} className="w-72" />
          <Button type="submit" size="sm" variant="outline">
            <Search /> Find
          </Button>
        </form>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} /> Open only
        </label>
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto"
          onClick={() =>
            platformClient
              .get('/support/test-error')
              .catch(() => null)
              .finally(() => setTimeout(load, 500))
          }
        >
          Test the error popup
        </Button>
      </div>
      {!rows ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : rows.length === 0 ? (
        <p className="rounded-md border p-6 text-sm text-muted-foreground">No errors{openOnly ? ' open' : ''}. </p>
      ) : (
        <div className="divide-y rounded-md border bg-card">
          {rows.map((r) => (
            <div key={r.code} className="p-3 text-sm">
              <button type="button" className="flex w-full flex-wrap items-start justify-between gap-2 text-left" onClick={() => setExpanded(expanded === r.code ? null : r.code)} aria-expanded={expanded === r.code}>
                <span className="min-w-0">
                  <span className="font-mono font-semibold">{r.code}</span>{' '}
                  <Badge variant={r.source === 'SERVER' ? 'info' : 'warning'}>{r.source === 'SERVER' ? 'Server' : 'App'}</Badge>{' '}
                  {r.level === 'crash' && <Badge variant="danger">Crash</Badge>} {r.help && <Badge variant="outline">{r.help.id}</Badge>}{' '}
                  {r.resolvedAt && <Badge variant="success">Fixed</Badge>}
                  <span className="mt-0.5 block truncate text-muted-foreground">{r.message}</span>
                  {r.where && <span className="block text-xs text-muted-foreground">{r.where}</span>}
                </span>
                <span className="shrink-0 text-right text-xs text-muted-foreground">
                  <span className="block font-medium text-foreground">{r.count}×</span>
                  last {when(r.lastSeen)}
                </span>
              </button>
              {expanded === r.code && (
                <div className="mt-3 space-y-3">
                  <div className="flex gap-2">
                    {r.resolvedAt ? (
                      <Button size="sm" variant="outline" onClick={() => resolve(r.code, false)}>
                        <RotateCcw /> Reopen
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => resolve(r.code, true)}>
                        <CheckCircle2 /> Mark fixed
                      </Button>
                    )}
                    <span className="self-center text-xs text-muted-foreground">First seen {when(r.firstSeen)}. A fixed error reopens if it happens again.</span>
                  </div>
                  {r.stack && <pre className="max-h-40 overflow-auto rounded-md bg-muted p-2 text-[11px]">{r.stack}</pre>}
                  <div className="space-y-2">
                    <div className="text-xs font-medium">Last {r.samples.length} occurrences</div>
                    {r.samples.map((s, i) => (
                      <div key={i} className="rounded-md border p-2 text-xs">
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground">
                          <span>{when(s.at)}</span>
                          {s.requestId && <span>ref {s.requestId}</span>}
                          {s.userId && <span>user {s.userId.slice(0, 8)}</span>}
                          {s.societyId && <span>society {s.societyId.slice(0, 8)}</span>}
                          {s.page && <span>{s.page}</span>}
                          {s.version && <span>v{s.version}</span>}
                        </div>
                        {s.steps?.length > 0 && <pre className="mt-1 whitespace-pre-wrap text-[11px]">{s.steps.join('\n')}</pre>}
                        {s.context ? <pre className="mt-1 whitespace-pre-wrap text-[11px] text-muted-foreground">{typeof s.context === 'string' ? s.context : JSON.stringify(s.context)}</pre> : null}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
