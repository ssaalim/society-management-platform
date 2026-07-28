# Society Management Platform

A multi-tenant SaaS application for housing society management.

## Architecture

- **Frontend**: Next.js App Router (React, Tailwind CSS, TanStack Query)
- **Backend**: NestJS, Drizzle ORM, PostgreSQL
- **Infrastructure**: Vercel (Frontend), Railway (Backend), Neon (Database), Supabase (Auth, Storage)

## Packages

This is a monorepo setup containing:
- `apps/frontend`: Web client
- `apps/backend`: Core API
- `packages/shared`: Shared types, DTOs, utilities
- `packages/ui`: Reusable UI components
- `packages/config`: Centralized configurations

## Prerequisites

- Node.js (v20+)
- Docker (optional, for local DB)
- Supabase account (for local/cloud Auth & Storage)
- Neon account (for PostgreSQL)

## Deployment

Refer to [DEPLOYMENT.md](DEPLOYMENT.md) for full deployment instructions.
