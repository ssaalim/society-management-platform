'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, Plus } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { FundEditor } from './fund-editor';
import { FundStatus, FundSummary, Notice, Progress, errText, fmtDate, rupees } from './fund-utils';

export function FundsList({ slug, canManage }: { slug: string; canManage: boolean }) {
  const router = useRouter();
  const [funds, setFunds] = useState<FundSummary[] | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get('/funds');
      setFunds(res.data.data);
    } catch (err) {
      setNotice({ type: 'error', text: errText(err, 'Could not load funds.') });
      setFunds([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Fund collection"
        description="Money raised for a purpose (generator, solar, painting), billed separately from maintenance."
        actions={
          canManage && (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus /> New fund
            </Button>
          )
        }
      />
      <Notice notice={notice} />
      {!funds ? (
        <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : funds.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">No fund collections yet.</CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {funds.map((f) => (
            <Link key={f.id} href={`/${slug}/funds/${f.id}`} className="block">
              <Card className="h-full transition hover:border-brand-300">
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">{f.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {f.methodLabel}
                        {f.dueDate && ` · pay by ${fmtDate(f.dueDate)}`}
                      </div>
                    </div>
                    <FundStatus status={f.status} />
                  </div>
                  {f.status !== 'DRAFT' && <Progress f={f} />}
                  {f.status !== 'DRAFT' && f.method !== 'VOLUNTARY' && (
                    <div className="text-xs text-muted-foreground">
                      {f.paidCount} of {f.shareCount} flats paid in full
                    </div>
                  )}
                  {!!f.pendingClaims && <Badge variant="info">{f.pendingClaims} payment{f.pendingClaims === 1 ? '' : 's'} to approve</Badge>}
                  {!!f.myShares && (
                    <div>{(f.myDue ?? 0) > 0 ? <Badge variant="warning">You owe {rupees(f.myDue || 0)}</Badge> : <Badge variant="success">Your share is settled</Badge>}</div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
      {creating && (
        <FundEditor
          onClose={() => setCreating(false)}
          onSaved={(id) => {
            setCreating(false);
            router.push(`/${slug}/funds/${id}`);
          }}
        />
      )}
    </div>
  );
}
