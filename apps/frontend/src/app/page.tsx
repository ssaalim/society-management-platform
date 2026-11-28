import React from 'react';
import Link from 'next/link';
import { Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const FEATURES = [
  { title: 'NestJS backend', body: 'Clean architecture, BaseRepository-enforced tenant boundaries, custom Zod request mapping.' },
  { title: 'Native JWT auth', body: 'Direct PostgreSQL authentication with bcrypt password hashing and stateless JWT validation.' },
  { title: 'Drizzle ORM', body: 'Fully type-safe SQL query generation mapping the database schema constraints automatically.' },
];

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-100 px-4 py-12 dark:bg-slate-950">
      <div className="w-full max-w-3xl space-y-8 text-center">
        <div className="flex flex-col items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-500 text-white">
            <Building2 className="h-6 w-6" />
          </span>
          <h1 className="text-3xl font-normal text-slate-900 dark:text-slate-100">Housive</h1>
          <p className="mx-auto max-w-xl text-slate-500">
            A multi-tenant platform for Indian housing societies: complete tenant isolation, role-based access, central auditing and background queues.
          </p>
        </div>

        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/login">Sign in to your society</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/platform/login">Platform admin</Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-3 text-left sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-lg border bg-card p-4">
              <h3 className="text-[15px] font-medium text-slate-900 dark:text-slate-100">{f.title}</h3>
              <p className="mt-1.5 text-sm text-slate-500">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
