'use client';

import { useEffect, useState } from 'react';
import { reportClientError } from '@/lib/diagnostics';

/** Last resort when the whole app (its layout) fails: plain page with the code, no app styles needed. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [code, setCode] = useState<string>('');
  useEffect(() => {
    void reportClientError(error, { level: 'crash', where: 'app-layout' }).then(setCode);
  }, [error]);
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', display: 'grid', placeItems: 'center', minHeight: '100vh', margin: 0, background: '#f8fafc', color: '#0f172a' }}>
        <div style={{ maxWidth: 420, padding: 24, textAlign: 'center' }}>
          <h1 style={{ fontSize: 20 }}>Housive could not load</h1>
          <p style={{ color: '#475569' }}>Your data is safe. Reload the page; if it keeps happening, give support this code.</p>
          <div style={{ fontFamily: 'monospace', fontSize: 28, fontWeight: 700, margin: '16px 0' }}>{code || '…'}</div>
          <p style={{ color: '#64748b', fontSize: 12 }}>{error.message}</p>
          <button onClick={() => reset()} style={{ padding: '8px 16px', marginRight: 8 }}>Try again</button>
          <button onClick={() => location.reload()} style={{ padding: '8px 16px' }}>Reload</button>
        </div>
      </body>
    </html>
  );
}
