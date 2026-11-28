'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Building2, LogOut, Moon, Sun } from 'lucide-react';
import { PLATFORM_TOKEN_KEY, platformClient } from '@/lib/api/client';
import { useTheme } from '../providers/theme-context';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface PlatformAdmin {
  id: string;
  email: string;
  name: string | null;
}

/**
 * Platform console (/platform): a separate area with its own sign-in and session, kept apart from society
 * workspaces (/<society-slug>/...). A platform session cannot open any society's data.
 */
export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const isLogin = pathname === '/platform/login';
  const [admin, setAdmin] = useState<PlatformAdmin | null>(null);

  useEffect(() => {
    if (isLogin) return;
    try {
      const raw = localStorage.getItem('platform_admin');
      if (!localStorage.getItem(PLATFORM_TOKEN_KEY) || !raw) {
        router.replace('/platform/login');
        return;
      }
      setAdmin(JSON.parse(raw));
    } catch {
      router.replace('/platform/login');
    }
  }, [isLogin, router]);

  if (isLogin) return <>{children}</>;
  if (!admin) return null;

  const signOut = () => {
    localStorage.removeItem(PLATFORM_TOKEN_KEY);
    localStorage.removeItem('platform_admin');
    router.replace('/platform/login');
  };
  const initials =
    (admin.name || admin.email)
      .split(/\s+/)
      .filter((w) => /^[a-z]/i.test(w))
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('') || 'P';

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 flex h-12 items-center gap-3 border-b border-sidebar-border bg-sidebar px-4">
        <Link href="/platform" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-white dark:bg-slate-700">
            <Building2 className="h-[17px] w-[17px]" />
          </span>
          <span className="leading-tight">
            <span className="block text-[15px] font-semibold text-slate-900 dark:text-slate-100">Housive Platform</span>
            <span className="block text-[11px] text-slate-500">Society administration</span>
          </span>
        </Link>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={toggleTheme} aria-label="Toggle theme" className="text-muted-foreground">
            {theme === 'dark' ? <Sun /> : <Moon />}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label={`Account menu for ${admin.name || admin.email}`} className="ml-1 rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-white dark:bg-slate-700">{initials}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="font-normal">
                <span className="block truncate font-medium">{admin.name || 'Platform admin'}</span>
                <span className="block truncate text-xs text-slate-500">{admin.email}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={signOut}>
                <LogOut />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      {children}
    </div>
  );
}

// Keep the platform client referenced so the session interceptor is registered with this layout.
void platformClient;
