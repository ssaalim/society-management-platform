'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { supabase } from '../../lib/supabase/client';
import { Mail, Phone, Lock, Eye, EyeOff, Loader2, Shield, Users, Briefcase, UserCheck, Home, Crown, Calculator } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const IS_DEV_AUTH = process.env.NEXT_PUBLIC_DEV_AUTH === 'true';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

// ============================================
// DEV USER CARD DEFINITIONS
// ============================================
interface DevUser {
  id: string;
  email: string;
  name: string;
  mobile: string | null;
  avatarUrl: string | null;
}

const ROLE_ICONS: Record<string, React.ReactNode> = {
  'SUPER_ADMIN': <Shield className="h-5 w-5" />,
  'PRESIDENT': <Crown className="h-5 w-5" />,
  'SECRETARY': <Briefcase className="h-5 w-5" />,
  'TREASURER': <UserCheck className="h-5 w-5" />,
  'ACCOUNTANT': <Calculator className="h-5 w-5" />,
  'COMMITTEE_MEMBER': <Users className="h-5 w-5" />,
  'OWNER': <Home className="h-5 w-5" />,
  'TENANT': <Home className="h-5 w-5 text-teal-400" />,
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

// ============================================
// DEV LOGIN COMPONENT
// ============================================
function DevLoginPage() {
  const [users, setUsers] = useState<DevUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customEmail, setCustomEmail] = useState<string>('');
  const [customPassword, setCustomPassword] = useState<string>('');
  const [isSubmittingCustom, setIsSubmittingCustom] = useState<boolean>(false);
  const router = useRouter();

  useEffect(() => {
    fetchDevUsers();
  }, []);

  const fetchDevUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/auth/dev-users`);
      const data = await res.json();
      if (data.success) {
        setUsers(data.data);
      } else {
        setError('Failed to load test users. Make sure backend is running.');
      }
    } catch (e) {
      setError('Cannot connect to backend at ' + API_URL + '. Make sure the backend server is running.');
    } finally {
      setLoading(false);
    }
  };

  const executeDevLogin = async (email: string, password?: string) => {
    setError(null);

    try {
      const res = await fetch(`${API_URL}/auth/dev-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password: password || 'password123' }),
      });

      const data = await res.json();

      if (data.success) {
        localStorage.setItem('dev_token', data.data.devToken);
        localStorage.setItem('dev_session', JSON.stringify({
          user: data.data.user,
          memberships: data.data.memberships,
        }));

        const memberships = data.data.memberships || [];
        const activeMemberships = memberships.filter((m: any) => !m.isExpired);
        const storedDefaultId = localStorage.getItem('default_society_id') || data.data.user?.defaultSocietyId;
        
        // Find active default, or fallback to first active membership, or first membership
        const activeDefault = activeMemberships.find((m: any) => m.societyId === storedDefaultId);
        const target = activeDefault || activeMemberships[0] || memberships[0];

        if (target) {
          localStorage.setItem('active_society_id', target.societyId);
          if (activeDefault) {
            localStorage.setItem('default_society_id', target.societyId);
          } else if (activeMemberships.length > 0 && storedDefaultId && !activeDefault) {
            // Previous default society was expired: auto-switch default to active society
            localStorage.setItem('default_society_id', target.societyId);
          }
        }

        const targetSlug = target?.societySlug;
        window.location.href = targetSlug ? `/${targetSlug}/dashboard` : '/';
      } else {
        setError(data.message || 'Login failed.');
      }
    } catch (e: any) {
      setError(e.message || 'Login request failed.');
    }
  };

  const handleDevLogin = async (user: DevUser) => {
    setLoginLoading(user.id);
    await executeDevLogin(user.email);
    setLoginLoading(null);
  };

  const handleCustomLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEmail.trim()) {
      setError('Please enter your Username or Email address.');
      return;
    }
    setIsSubmittingCustom(true);
    await executeDevLogin(customEmail, customPassword);
    setIsSubmittingCustom(false);
  };

  const getRoleForUser = (email: string) => {
    return ROLE_LABELS[email] || 'OWNER';
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden py-12 px-4 sm:px-6 lg:px-8">
      {/* Premium Background */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,#000_70%,transparent_100%)]" />
      <div className="absolute top-1/4 left-1/4 h-[300px] w-[300px] rounded-full bg-violet-600/5 blur-[120px]" />
      <div className="absolute bottom-1/4 right-1/4 h-[250px] w-[250px] rounded-full bg-indigo-500/5 blur-[100px]" />

      <div className="w-full max-w-xl z-10 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-950/30 px-4 py-1.5 text-xs text-amber-400 backdrop-blur-md">
            <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            Society Portal Login
          </div>
          <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-100 to-slate-400 bg-clip-text text-transparent">
            Sign In to System
          </h2>
          <p className="text-sm text-slate-400">
            Enter your Username/Email and password to log in.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-red-950/40 border border-red-900/50 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Direct Username / Email & Password Login Form */}
        <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl backdrop-blur-xl shadow-2xl space-y-4">
          <form onSubmit={handleCustomLoginSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-1">
                <Mail className="h-3.5 w-3.5 text-indigo-400" /> Username / Email Address
              </label>
              <input
                type="text"
                value={customEmail}
                onChange={(e) => setCustomEmail(e.target.value)}
                placeholder="e.g. resident@society.dev or john@example.com"
                className="w-full rounded-lg border border-slate-800 bg-slate-950/80 py-2.5 px-3.5 text-sm text-slate-200 placeholder-slate-600 focus:border-indigo-600/50 focus:outline-none transition-all font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-1">
                <Lock className="h-3.5 w-3.5 text-indigo-400" /> Password
              </label>
              <input
                type="password"
                value={customPassword}
                onChange={(e) => setCustomPassword(e.target.value)}
                placeholder="Enter your system password"
                className="w-full rounded-lg border border-slate-800 bg-slate-950/80 py-2.5 px-3.5 text-sm text-slate-200 placeholder-slate-600 focus:border-indigo-600/50 focus:outline-none transition-all font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmittingCustom || !customEmail.trim()}
              className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-sm font-semibold text-white transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
            >
              {isSubmittingCustom ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Authenticating...</>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>

        {/* Quick Dev User Selector Section */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between text-xs text-slate-500 border-t border-slate-800/80 pt-4">
            <span>Or Quick Select Pre-seeded Member Accounts</span>
            <span className="font-mono text-[10px]">Development Directory</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 text-indigo-500 animate-spin" />
            </div>
          ) : users.length === 0 ? null : (
            <div className="grid grid-cols-1 gap-2.5 max-h-[260px] overflow-y-auto pr-1">
              {users.map((user) => {
                const role = getRoleForUser(user.email);
                const colorClass = ROLE_COLORS[role] || ROLE_COLORS['OWNER'];
                const icon = ROLE_ICONS[role] || ROLE_ICONS['OWNER'];
                const isLoggingIn = loginLoading === user.id;

                return (
                  <button
                    key={user.id}
                    onClick={() => handleDevLogin(user)}
                    disabled={!!loginLoading}
                    className={`group relative flex items-center gap-3 rounded-xl border bg-gradient-to-r ${colorClass} p-3 text-left transition-all hover:scale-[1.01] hover:shadow-lg disabled:opacity-50 backdrop-blur-md`}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-950/50 border border-slate-700/50">
                      {isLoggingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-semibold text-slate-200 truncate">{user.name}</h3>
                        <span className="shrink-0 rounded-full bg-slate-950/50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                          {role.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-mono truncate">{user.email}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

// ============================================
// PRODUCTION LOGIN COMPONENT (Supabase)
// ============================================
const loginSchema = z.object({
  email: z.string().email({ message: 'Enter a valid email address.' }).optional(),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }).optional(),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, { message: 'Enter valid phone with country code (e.g. +919999999999).' }).optional(),
  otp: z.string().length(6, { message: 'OTP must be exactly 6 digits.' }).optional(),
});

type LoginSchema = z.infer<typeof loginSchema>;

function SupabaseLoginPage() {
  const [loginMode, setLoginMode] = useState<'email' | 'otp'>('email');
  const [otpSent, setOtpSent] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const router = useRouter();

  const { register, handleSubmit, formState: { errors }, watch } = useForm<LoginSchema>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginSchema) => {
    setIsLoading(true);
    setAuthError(null);

    try {
      if (loginMode === 'email') {
        if (!data.email || !data.password) {
          setAuthError('Email and Password are required.');
          setIsLoading(false);
          return;
        }

        const { error } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        });

        if (error) throw error;
        router.push('/');
      } else {
        // OTP Login Flow
        if (!data.phone) {
          setAuthError('Phone number is required.');
          setIsLoading(false);
          return;
        }

        if (!otpSent) {
          const { error } = await supabase.auth.signInWithOtp({
            phone: data.phone,
          });

          if (error) throw error;
          setOtpSent(true);
        } else {
          if (!data.otp) {
            setAuthError('Enter the 6-digit OTP code.');
            setIsLoading(false);
            return;
          }

          const { error } = await supabase.auth.verifyOtp({
            phone: data.phone,
            token: data.otp,
            type: 'sms',
          });

          if (error) throw error;
          router.push('/');
        }
      }
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed. Please check credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setAuthError(err.message || 'Google authentication failed.');
      setIsLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden py-12 px-4 sm:px-6 lg:px-8">
      {/* Premium Background styling */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,#000_70%,transparent_100%)]" />
      <div className="absolute top-1/4 left-1/4 h-[300px] w-[300px] rounded-full bg-violet-600/5 blur-[120px]" />
      <div className="absolute bottom-1/4 right-1/4 h-[250px] w-[250px] rounded-full bg-indigo-500/5 blur-[100px]" />

      <div className="w-full max-w-md z-10 space-y-8 bg-slate-900/40 border border-slate-800 p-8 rounded-2xl backdrop-blur-xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-100 to-slate-400 bg-clip-text text-transparent">
            Welcome Back
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Sign in to access your society dashboard
          </p>
        </div>

        {/* Toggle Mode Button */}
        <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800">
          <button
            type="button"
            className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-all ${
              loginMode === 'email' ? 'bg-slate-900 text-slate-100 shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
            onClick={() => {
              setLoginMode('email');
              setOtpSent(false);
              setAuthError(null);
            }}
          >
            Email Login
          </button>
          <button
            type="button"
            className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-all ${
              loginMode === 'otp' ? 'bg-slate-900 text-slate-100 shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
            onClick={() => {
              setLoginMode('otp');
              setOtpSent(false);
              setAuthError(null);
            }}
          >
            OTP Login
          </button>
        </div>

        {authError && (
          <div className="rounded-lg bg-red-950/40 border border-red-900/50 p-4 text-sm text-red-400">
            {authError}
          </div>
        )}

        <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
          {loginMode === 'email' ? (
            <>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                  <input
                    {...register('email')}
                    type="email"
                    placeholder="name@society.com"
                    className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 pl-10 pr-4 text-sm text-slate-200 placeholder-slate-600 focus:border-slate-700 focus:outline-none"
                  />
                </div>
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                  <input
                    {...register('password')}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 pl-10 pr-12 text-sm text-slate-200 placeholder-slate-600 focus:border-slate-700 focus:outline-none"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-3 h-4 w-4 text-slate-500 hover:text-slate-300"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400">Phone Number (with Country Code)</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                  <input
                    {...register('phone')}
                    type="tel"
                    placeholder="+919999999999"
                    disabled={otpSent}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 pl-10 pr-4 text-sm text-slate-200 placeholder-slate-600 focus:border-slate-700 focus:outline-none disabled:opacity-55"
                  />
                </div>
                {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone.message}</p>}
              </div>

              {otpSent && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400">Verification OTP</label>
                  <div className="relative">
                    <input
                      {...register('otp')}
                      type="text"
                      maxLength={6}
                      placeholder="123456"
                      className="w-full text-center tracking-[0.5em] font-mono rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:border-slate-700 focus:outline-none"
                    />
                  </div>
                  {errors.otp && <p className="text-xs text-red-500 mt-1">{errors.otp.message}</p>}
                </div>
              )}
            </>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center items-center rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-900 py-2.5 font-medium transition-all focus:outline-none disabled:opacity-55"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : loginMode === 'otp' && !otpSent ? (
              'Send OTP Verification'
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="relative flex py-2 items-center">
          <div className="flex-grow border-t border-slate-800"></div>
          <span className="flex-shrink mx-4 text-xs text-slate-500 font-semibold uppercase">Or continue with</span>
          <div className="flex-grow border-t border-slate-800"></div>
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className="w-full flex justify-center items-center gap-2 rounded-lg border border-slate-800 hover:bg-slate-900/60 text-slate-300 py-2.5 font-medium transition-all"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
          </svg>
          Google Workspace
        </button>
      </div>
    </main>
  );
}

// ============================================
// MAIN EXPORT (auto-selects dev vs prod login)
// ============================================
function LoginContent() {
  const searchParams = useSearchParams();
  const mode = searchParams.get('mode');
  
  if (mode === 'prod') {
    return <SupabaseLoginPage />;
  }
  
  if (mode === 'dev' || IS_DEV_AUTH) {
    return <DevLoginPage />;
  }
  
  return <SupabaseLoginPage />;
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#09090b] text-white"><Loader2 className="h-8 w-8 animate-spin text-indigo-500" /></div>}>
      <LoginContent />
    </Suspense>
  );
}
