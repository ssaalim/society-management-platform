'use client';

import React from 'react';
import { AuthProvider } from './auth-context';
import { ThemeProvider } from './theme-context';
import { SidebarProvider } from './sidebar-context';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SidebarProvider>{children}</SidebarProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

