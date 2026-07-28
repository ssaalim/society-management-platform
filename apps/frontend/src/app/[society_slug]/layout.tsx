'use client';

import React from 'react';
import { Navbar } from '../../components/layout/navbar';
import { ProtectedRoute } from '../../components/auth/protected-route';

export default function SocietySlugLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#030712] text-slate-100 flex flex-col">
        <Navbar />
        <div className="flex-1">{children}</div>
      </div>
    </ProtectedRoute>
  );
}
