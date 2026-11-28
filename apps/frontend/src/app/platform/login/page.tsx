'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';
import { PLATFORM_TOKEN_KEY, platformClient } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/** Platform console sign-in. Only platform administrators can sign in here; society users use /login. */
export default function PlatformLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(PLATFORM_TOKEN_KEY)) {
        router.replace('/platform');
        return;
      }
      const handedOver = sessionStorage.getItem('platform_login_email');
      if (handedOver) {
        setEmail(handedOver);
        sessionStorage.removeItem('platform_login_email');
      }
    } catch {
      /* private mode */
    }
  }, [router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await platformClient.post('/auth/platform-login', { email: email.trim(), password });
      localStorage.setItem(PLATFORM_TOKEN_KEY, res.data.data.token);
      localStorage.setItem('platform_admin', JSON.stringify(res.data.data.admin));
      router.replace('/platform');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-12 dark:bg-slate-950">
      <div className="w-full max-w-sm space-y-5">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-800 text-white dark:bg-slate-700">
            <ShieldCheck className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-xl font-normal text-slate-900 dark:text-slate-100">Housive Platform</h1>
            <p className="mt-1 text-sm text-slate-500">Sign in to manage societies, plans and subscriptions</p>
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300">{error}</div>
        )}

        <form onSubmit={submit} className="space-y-4 rounded-lg border bg-card p-6">
          <div className="space-y-1.5">
            <Label htmlFor="platform-email">Email</Label>
            <Input id="platform-email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="platform-password">Password</Label>
            <div className="relative">
              <Input
                id="platform-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? (
              <>
                <Loader2 className="animate-spin" /> Signing in…
              </>
            ) : (
              <>
                Sign in <ArrowRight />
              </>
            )}
          </Button>
        </form>

        <p className="text-center text-sm text-slate-500">
          Society member?{' '}
          <a href="/login" className="text-brand-600 hover:underline dark:text-brand-400">
            Sign in to your society
          </a>
        </p>
      </div>
    </main>
  );
}
