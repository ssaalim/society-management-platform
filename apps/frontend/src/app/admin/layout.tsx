'use client';

import React from 'react';
import { Navbar } from '../../components/layout/navbar';
import { ProtectedRoute } from '../../components/auth/protected-route';

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <Navbar>{children}</Navbar>
    </ProtectedRoute>
  );
}
