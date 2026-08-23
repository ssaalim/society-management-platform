'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Suspense } from 'react';
import { Mail, Lock, Eye, EyeOff, Loader2, Shield, Users, Briefcase, UserCheck, Home, Crown, Calculator, ArrowRight } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { apiClient } from '../../lib/api/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

interface DemoUser {
  id: string;
  email: string;
  name: string;
  mobile: string | null;
  avatarUrl: string | null;
}

const ROLE_ICONS: Record<string, React.ReactNode> = {
  'SUPER_ADMIN': <Shield className="h-4 w-4" />,
  'PRESIDENT': <Crown className="h-4 w-4" />,
  'SECRETARY': <Briefcase className="h-4 w-4" />,
  'TREASURER': <UserCheck className="h-4 w-4" />,
  'ACCOUNTANT': <Calculator className="h-4 w-4" />,
  'COMMITTEE_MEMBER': <Users className="h-4 w-4" />,
  'OWNER': <Home className="h-4 w-4" />,
  'TENANT': <Home className="h-4 w-4 text-teal-400" />,
};

const ROLE_COLORS: Record<string, string> = {
  'SUPER_ADMIN': 'from-red-500/20 to-red-600/10 border-red-500/30 text-red-400',
  'PRESIDENT': 'from-amber-500/20 to-orange-600/10 border-amber-500/30 text-amber-400',
  'SECRETARY': 'from-violet-500/20 to-violet-600/10 border-violet-500/30 text-violet-400',
  'TREASURER': 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 text-emerald-400',
  'ACCOUNTANT': 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 text-cyan-400',
  'COMMITTEE_MEMBER': 'from-amber-500/20 to-amber-600/10 border-amber-500/30 text-amber-400',
  'OWNER': 'from-sky-500/20 to-sky-600/10 border-sky-500/30 text-sky-400',
  'TENANT': 'from-teal-500/20 to-teal-600/10 border-teal-500/30 text-teal-400',
};

const ROLE_LABELS: Record<string, string> = {
  'superadmin@society.dev': 'SUPER_ADMIN',
  'president@society.dev': 'PRESIDENT',
  'secretary@society.dev': 'SECRETARY',
  'treasurer@society.dev': 'TREASURER',
  'accountant@society.dev': 'ACCOUNTANT',
  'committee@society.dev': 'COMMITTEE_MEMBER',
  'resident@society.dev': 'OWNER',
  'tenant1@society.dev': 'TENANT',
};

const loginSchema = z.object({
  email: z.string().min(1, { message: 'Email address is required.' }).email({ message: 'Enter a valid email address.' }),
  password: z.string().min(1, { message: 'Password is required.' }),
});

type LoginFormData = z.infer<typeof loginSchema>;

function LoginPageContent() {
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [demoUsers, setDemoUsers] = useState<DemoUser[]>([]);
  const [demoLoading, setDemoLoading] = useState<string | null>(null);
  const router = useRouter();

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  useEffect(() => {
    fetchDemoUsers();
  }, []);

  const fetchDemoUsers = async () => {
    try {
      const res = await apiClient.get('/auth/dev-users');
      if (res.data?.success && Array.isArray(res.data.data)) {
        setDemoUsers(res.data.data);
      }
    } catch {}
  };

  const handleLoginSuccess = (data: any) => {
    const token = data.token;
    localStorage.setItem('auth_token', token);
    localStorage.setItem('dev_token', token);

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

    const isSuperAdmin = data.user?.email?.includes('superadmin') || memberships.some((m: any) => m.role === 'SUPER_ADMIN');
    if (isSuperAdmin && !target) {
      window.location.href = '/admin';
      return;
    }

    const targetSlug = target?.societySlug;
    window.location.href = targetSlug ? `/${targetSlug}/dashboard` : '/';
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

  const handleQuickSelect = async (user: DemoUser) => {
    setValue('email', user.email);
    setValue('password', 'password123');
    setDemoLoading(user.id);
    setAuthError(null);

    try {
      const response = await apiClient.post('/auth/login', {
        email: user.email,
        password: 'password123',
      });

      if (response.data?.success) {
        handleLoginSuccess(response.data.data);
      } else {
        setAuthError(response.data?.message || 'Login failed.');
      }
    } catch (err: any) {
      setAuthError(err.response?.data?.message || err.message || 'Login failed.');
    } finally {
      setDemoLoading(null);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden py-12 px-4 sm:px-6 lg:px-8">
      {/* Background Ambience */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,#000_70%,transparent_100%)]" />
      <div className="absolute top-1/4 left-1/4 h-[320px] w-[320px] rounded-full bg-violet-600/10 blur-[130px]" />
      <div className="absolute bottom-1/4 right-1/4 h-[280px] w-[280px] rounded-full bg-indigo-500/10 blur-[110px]" />

      <div className="w-full max-w-md z-10 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-950/40 px-4 py-1 text-xs text-indigo-300 backdrop-blur-md">
            <span className="flex h-2 w-2 rounded-full bg-indigo-400 animate-pulse" />
            Society Management Platform
          </div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-100 to-slate-400 bg-clip-text text-transparent">
            Welcome Back
          </h1>
          <p className="text-sm text-slate-400">
            Sign in with your email and password to access your dashboard
          </p>
        </div>

        {/* Error Notification */}
        {authError && (
          <div className="rounded-xl bg-red-950/50 border border-red-900/60 p-3.5 text-sm text-red-300 flex items-start gap-2 shadow-lg backdrop-blur-md">
            <span className="text-red-400 mt-0.5">•</span>
            <span>{authError}</span>
          </div>
        )}

        {/* Login Form Card */}
        <div className="bg-slate-900/60 border border-slate-800/90 p-7 rounded-2xl backdrop-blur-xl shadow-2xl space-y-5">
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-indigo-400" />
                Email Address
              </label>
              <div className="relative">
                <input
                  {...register('email')}
                  type="email"
                  placeholder="name@society.dev"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-2.5 px-3.5 text-sm text-slate-200 placeholder-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
                />
              </div>
              {errors.email && <p className="text-xs text-red-400">{errors.email.message}</p>}
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-indigo-400" />
                Password
              </label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••••••"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-2.5 pl-3.5 pr-10 text-sm text-slate-200 placeholder-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-400">{errors.password.message}</p>}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 text-sm font-semibold text-white transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 mt-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Signing In...
                </>
              ) : (
                <>
                  Sign In <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Quick Demo Role Selector */}
        {demoUsers.length > 0 && (
          <div className="space-y-2.5 pt-2">
            <div className="flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80 pt-4 px-1">
              <span>Quick Login (Demo Accounts)</span>
              <span className="text-[10px] text-slate-500 font-mono">Password: password123</span>
            </div>

            <div className="grid grid-cols-1 gap-2 max-h-[220px] overflow-y-auto pr-1">
              {demoUsers.map((user) => {
                const role = ROLE_LABELS[user.email] || 'OWNER';
                const colorClass = ROLE_COLORS[role] || ROLE_COLORS['OWNER'];
                const icon = ROLE_ICONS[role] || ROLE_ICONS['OWNER'];
                const isThisLoading = demoLoading === user.id;

                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => handleQuickSelect(user)}
                    disabled={!!demoLoading}
                    className={`group flex items-center gap-3 rounded-xl border bg-gradient-to-r ${colorClass} p-2.5 text-left transition-all hover:scale-[1.01] hover:brightness-110 disabled:opacity-50 backdrop-blur-md`}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-950/60 border border-slate-700/50">
                      {isThisLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-white" /> : icon}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-200 truncate">{user.name}</span>
                        <span className="shrink-0 rounded-full bg-slate-950/60 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider">
                          {role.replace('_', ' ')}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono block truncate">{user.email}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}
