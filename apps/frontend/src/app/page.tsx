import React from 'react';
import Link from 'next/link';

export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden py-12 px-4 sm:px-6 lg:px-8">
      {/* Background Decorative Gradients */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
      <div className="absolute top-0 right-1/4 h-[300px] w-[300px] rounded-full bg-violet-600/10 blur-[120px]" />
      <div className="absolute bottom-10 left-1/4 h-[250px] w-[250px] rounded-full bg-indigo-500/10 blur-[100px]" />

      <div className="w-full max-w-4xl text-center z-10 space-y-8">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/60 px-4 py-1.5 text-xs text-slate-300 backdrop-blur-md">
          <span className="flex h-2 w-2 rounded-full bg-violet-500 animate-pulse" />
          Production-Grade SaaS Architecture
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl bg-gradient-to-r from-slate-100 via-slate-200 to-slate-400 bg-clip-text text-transparent">
          Housive
        </h1>

        {/* Subtitle */}
        <p className="mx-auto max-w-2xl text-lg text-slate-400">
          A scalable multi-tenant platform designed for Indian societies, featuring complete tenant isolation, robust RBAC, centralized auditing, and high-performance background queues.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
          <Link
            href="/login?mode=prod"
            className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-all"
          >
            Normal Login
          </Link>
          <Link
            href="/login?mode=dev"
            className="rounded-lg border border-slate-700 bg-slate-800/50 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-600 transition-all backdrop-blur-sm"
          >
            Dev Login
          </Link>
        </div>

        {/* Technical Architecture Overview Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mt-12 text-left">
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 backdrop-blur-md">
            <h3 className="font-semibold text-slate-200">NestJS Backend</h3>
            <p className="mt-2 text-sm text-slate-400">Clean architecture, BaseRepository-enforced tenant boundaries, custom Zod request mapping.</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 backdrop-blur-md">
            <h3 className="font-semibold text-slate-200">Supabase Auth</h3>
            <p className="mt-2 text-sm text-slate-400">Secure user accounts, metadata injection, and JWT signature validation at NestJS controllers.</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 backdrop-blur-md">
            <h3 className="font-semibold text-slate-200">Drizzle ORM</h3>
            <p className="mt-2 text-sm text-slate-400">Fully type-safe SQL query generation mapping the database schema constraints automatically.</p>
          </div>
        </div>

        {/* Footer info */}
        <div className="pt-8 text-xs text-slate-600">
          Workspace Directory structure validated and fully set up.
        </div>
      </div>
    </main>
  );
}
