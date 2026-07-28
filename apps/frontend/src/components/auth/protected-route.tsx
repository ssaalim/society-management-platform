'use client';

import React, { useEffect } from 'react';
import { useAuth } from '../../app/providers/auth-context';
import { useRouter } from 'next/navigation';
import { Loader2, ShieldAlert } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requiredPermission 
}) => {
  const { user, loading, activeSociety } = useAuth();
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

  // Validate active tenant scope
  if (!activeSociety) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#030712] px-4 text-center space-y-4">
        <ShieldAlert className="h-12 w-12 text-yellow-500" />
        <h3 className="text-xl font-bold text-slate-200">No Society Workspace</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
          You are authenticated, but you are not mapped to any society. Contact your society administrator to be registered.
        </p>
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
