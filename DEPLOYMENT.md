# Society Management Platform Deployment Guide

This document details how to deploy the Monorepo to production across Vercel (Frontend), Railway (Backend), and Neon (Database).

## Architecture
- **Frontend**: Next.js App Router -> Vercel
- **Backend**: NestJS -> Railway
- **Database**: PostgreSQL -> Neon
- **Auth/Storage**: Supabase

---

## 1. Neon Database Setup
1. Create a project in [Neon](https://neon.tech).
2. Copy the **Connection String** (Pooled connection recommended).
3. Set this connection string as the `DATABASE_URL` environment variable for your Backend in Railway.

## 2. Supabase Setup
1. Create a [Supabase](https://supabase.com) project.
2. Under **Project Settings > API**, copy the `Project URL`, `anon public` key, and `service_role` key.
3. In **Storage**, create a bucket (e.g., `society_assets`) and make it public if serving images.

## 3. GitHub Integration
The deployment pipeline uses the `.github/workflows/ci.yml` pipeline for Continuous Integration.
1. Commit all files and push to a new GitHub repository.

## 4. Backend Deployment (Railway)
1. Go to [Railway Dashboard](https://railway.app).
2. Click **New Project** -> **Deploy from GitHub repo**.
3. Select this repository.
4. Railway will automatically detect `railway.json` and build using `docker/backend.Dockerfile`.
5. **Environment Variables Required in Railway**:
   - `DATABASE_URL` (From Neon)
   - `PORT=4000`
   - `NODE_ENV=production`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `FRONTEND_URL` (Set this after Vercel deployment)
   - *If using queues:* Add a Redis plugin in Railway and it will automatically set `REDIS_URL`.

## 5. Frontend Deployment (Vercel)
1. Go to [Vercel Dashboard](https://vercel.com).
2. Click **Add New Project** -> Import your GitHub repository.
3. Vercel will auto-detect the monorepo configuration from `vercel.json` and set the root directory to `apps/frontend`.
4. **Environment Variables Required in Vercel**:
   - `NEXT_PUBLIC_API_URL` (Set to the Railway public domain, e.g., `https://backend-xyz.up.railway.app/api/v1`)
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## Deployment Checklist
- [ ] Neon DB created.
- [ ] Supabase project created.
- [ ] Code pushed to GitHub.
- [ ] Railway project connected. Environment variables set. Domain generated.
- [ ] Database migrated (Run `npm run migration` locally pointing to Neon DB).
- [ ] Vercel project connected. Environment variables set (using Railway domain for API).
- [ ] Update Railway `FRONTEND_URL` environment variable with the generated Vercel domain.

## Rollback Steps
### Vercel (Frontend)
1. In Vercel, go to the **Deployments** tab.
2. Find the previous stable deployment.
3. Click **Promote to Production** or **Rollback**.

### Railway (Backend)
1. In Railway, click on the service.
2. Go to the **Deployments** tab.
3. Find the previous stable build, click the three dots, and select **Rollback**.
