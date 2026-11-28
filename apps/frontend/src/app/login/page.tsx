'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Suspense } from 'react';
import { Eye, EyeOff, Loader2, ArrowRight, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { apiClient } from '../../lib/api/client';

const loginSchema = z.object({
  email: z.string().min(1, { message: 'Email address is required.' }).email({ message: 'Enter a valid email address.' }),
  password: z.string().min(1, { message: 'Password is required.' }),
});

type LoginFormData = z.infer<typeof loginSchema>;

function LoginPageContent() {
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const router = useRouter();

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const handleLoginSuccess = (data: any) => {
    const token = data.token;
    localStorage.setItem('auth_token', token);

    const memberships = data.memberships || [];
    const activeMemberships = memberships.filter((m: any) => !m.isExpired);
    const storedDefaultId = localStorage.getItem('default_society_id') || data.user?.defaultSocietyId;
    
    const activeDefault = activeMemberships.find((m: any) => m.societyId === storedDefaultId);
    const target = activeDefault || activeMemberships[0] || memberships[0];

    if (target) {
      localStorage.setItem('active_society_id', target.societyId);
      if (activeDefault) {
        localStorage.setItem('default_society_id', target.societyId);
      }
    }

    if (!target) {
      // Platform admins are not members of any society; their console has its own sign-in.
      localStorage.removeItem('auth_token');
      if (data.isPlatformAdmin) {
        sessionStorage.setItem('platform_login_email', data.user?.email || '');
        window.location.href = '/platform/login';
      } else {
        setAuthError('Your account is not a member of any society yet. Ask your society office to add you.');
      }
      return;
    }

    window.location.href = `/${target.societySlug}/dashboard`;
  };

  const onSubmit = async (formData: LoginFormData) => {
    setIsLoading(true);
    setAuthError(null);

    try {
      const response = await apiClient.post('/auth/login', {
        email: formData.email.trim(),
        password: formData.password,
      });

      if (response.data?.success) {
        handleLoginSuccess(response.data.data);
      } else {
        setAuthError(response.data?.message || 'Login failed.');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Invalid email or password.';
      setAuthError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-12 dark:bg-slate-950">
      <div className="w-full max-w-sm space-y-5">
        {/* Brand */}
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-500 text-white">
            <Building2 className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-xl font-normal text-slate-900 dark:text-slate-100">Sign in to Housive</h1>
            <p className="mt-1 text-sm text-slate-500">Society management platform</p>
          </div>
        </div>

        {authError && (
          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300">
            <span className="mt-0.5">•</span>
            <span>{authError}</span>
          </div>
        )}

        {/* Login form */}
        <div className="rounded-lg border bg-card p-6">
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-1.5">
              <Label htmlFor="login-email">Email</Label>
              <Input id="login-email" {...register('email')} type="email" autoComplete="email" placeholder="name@society.dev" aria-invalid={!!errors.email} />
              {errors.email && <p className="text-xs text-red-600 dark:text-red-400">{errors.email.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="login-password">Password</Label>
              <div className="relative">
                <Input
                  id="login-password"
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="pr-10"
                  aria-invalid={!!errors.password}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-700 dark:hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-600 dark:text-red-400">{errors.password.message}</p>}
            </div>

            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? (
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
        </div>

        <p className="text-center text-sm text-slate-500">
          Manage societies?{' '}
          <a href="/platform/login" className="text-brand-600 hover:underline dark:text-brand-400">
            Platform admin sign-in
          </a>
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-slate-100 dark:bg-slate-950 text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}
