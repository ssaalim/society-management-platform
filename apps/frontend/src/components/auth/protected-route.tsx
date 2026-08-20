'use client';

import React, { useEffect } from 'react';
import { useAuth } from '../../app/providers/auth-context';
import { useRouter } from 'next/navigation';
import { Loader2, ShieldAlert, AlertCircle, ArrowRight, LogOut, Building } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requiredPermission 
}) => {
  const { 
    user, 
    loading, 
    activeSociety, 
    memberships, 
    allSocietiesExpired, 
    switchSociety, 
    signOut 
  } = useAuth();
  
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // Render spinner while checking authentication state
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#030712]">
        <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  // If no user session exists, return null (handled by useEffect redirect)
  if (!user) {
    return null;
  }

  // Handle all societies expired or current active society expired
  if (allSocietiesExpired || (activeSociety && activeSociety.isExpired)) {
    const activeAlternative = memberships.find(m => !m.isExpired);

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#030712] px-4 text-center space-y-6">
        <div className="p-4 rounded-2xl bg-red-950/40 border border-red-900/60 text-red-400">
          <AlertCircle className="h-12 w-12" />
        </div>
        <div className="space-y-2 max-w-md">
          <h3 className="text-2xl font-bold text-slate-100">Society Subscription Expired</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            The subscription plan for <strong className="text-slate-200">{activeSociety?.societyName || 'this society'}</strong> has expired. Login and member access are currently restricted until the plan is renewed by the platform administrator.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          {activeAlternative && (
            <button
              onClick={() => switchSociety(activeAlternative.societyId)}
              className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 text-xs font-semibold flex items-center gap-2 transition-all shadow-md shadow-indigo-950/40"
            >
              <Building className="h-4 w-4" />
              <span>Switch to {activeAlternative.societyName}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}

          <button
            onClick={signOut}
            className="rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-300 px-4 py-2.5 text-xs font-semibold flex items-center gap-2 transition-all"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    );
  }

  // Validate active tenant scope
  if (!activeSociety) {
    const isSuperAdmin = memberships.some(m => m.role === 'SUPER_ADMIN') || user?.email?.toLowerCase().includes('superadmin');

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#030712] px-4 text-center space-y-4">
        <ShieldAlert className="h-12 w-12 text-yellow-500" />
        <h3 className="text-xl font-bold text-slate-200">No Society Workspace Selected</h3>
        <p className="text-sm text-slate-400 max-w-sm">
          {isSuperAdmin
            ? 'You are logged in as Platform Super Administrator. You can access the Admin Console to manage societies and system settings.'
            : 'You are authenticated, but you are not mapped to any active society. Contact your society administrator to be registered.'}
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          {isSuperAdmin && (
            <button
              onClick={() => router.push('/admin')}
              className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 text-xs font-semibold flex items-center gap-2 transition-all shadow-md shadow-indigo-950/40"
            >
              <Building className="h-4 w-4" />
              <span>Go to Platform Admin Console</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}

          <button
            onClick={signOut}
            className="rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-300 px-4 py-2.5 text-xs font-semibold flex items-center gap-2 transition-all"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    );
  }

  // Validate permission scope if requested
  if (requiredPermission && !activeSociety.permissions.includes(requiredPermission)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#030712] px-4 text-center space-y-4">
        <ShieldAlert className="h-12 w-12 text-red-500" />
        <h3 className="text-xl font-bold text-slate-200">Access Denied</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
          You do not have the required scope permission (`{requiredPermission}`) to view this area.
        </p>
      </div>
    );
  }

  return <>{children}</>;
};
