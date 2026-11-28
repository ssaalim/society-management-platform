'use client';

import React from 'react';
import { AuthProvider } from './auth-context';
import { ThemeProvider } from './theme-context';
import { SidebarProvider } from './sidebar-context';
import { ErrorCenter } from '@/components/errors/error-center';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SidebarProvider>
          {children}
          <ErrorCenter />
        </SidebarProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

