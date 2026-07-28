'use client';

import React from 'react';
import { AuthProvider } from './auth-context';
import { ThemeProvider } from './theme-context';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>{children}</AuthProvider>
    </ThemeProvider>
  );
}
