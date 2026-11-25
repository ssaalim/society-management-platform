'use client';

import { useEffect, useState } from 'react';
import { Home, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ErrorBody } from '@/components/errors/error-center';
import { buildDetails, classifyClientError, reportClientError } from '@/lib/diagnostics';

/** A screen that crashed shows this recovery page with a code (instead of a blank page), and the crash is reported. */
export default function ScreenError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [code, setCode] = useState<string | null>(null);
  useEffect(() => {
    void reportClientError(error, { level: 'crash', context: error.digest ? { digest: error.digest } : undefined }).then(setCode);
  }, [error]);
  const details = buildDetails({
    title: 'This screen hit a problem',
    message: 'Your data is safe. Try again, or go back to the dashboard.',
    code,
    help: classifyClientError(error.message),
    crash: true,
  });
  details.message = `Your data is safe. Try again, or go back to the dashboard. (${error.message})`;
  const home = typeof location !== 'undefined' ? `/${location.pathname.split('/')[1] || ''}` : '/';
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-4 rounded-lg border bg-card p-6">
        <ErrorBody d={details} asPage />
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={reset}>
            <RefreshCw /> Try again
          </Button>
          <Button variant="outline" asChild>
            <a href={home === '/' || home === '/platform' ? home : `${home}/dashboard`}>
              <Home /> Dashboard
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
