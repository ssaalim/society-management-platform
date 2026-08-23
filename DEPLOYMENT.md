# 🚀 Free Deployment Guide: Neon & Vercel (+ Render / Koyeb for Backend)

This guide provides the step-by-step configuration to deploy the complete Society Management Platform **100% free** using:
- **Database**: [Neon](https://neon.tech) (Free Serverless PostgreSQL with PgBouncer Pooling)
- **Frontend**: [Vercel](https://vercel.com) (Free Hobby Tier with Edge CDN & Custom Domain)
- **Backend API**: [Render](https://render.com) or [Koyeb](https://koyeb.com) (Free Web Service Tier)
- **Authentication**: Native NestJS JWT + bcrypt directly on Neon PostgreSQL

---

## 1. 🗄️ Neon PostgreSQL Setup (Free Tier)

1. Sign up at [neon.tech](https://neon.tech) (free, no credit card required).
2. Click **Create Project**, name it (e.g., `society-db`), and select a region closest to your users (e.g., `AWS ap-south-1 Mumbai` or `us-east-2`).
3. In your Neon Dashboard, go to **Connection Details**:
   - Check the **Pooled connection** checkbox (enables PgBouncer pooling on port 5432/6543).
   - Copy the connection string. It looks like:
     ```env
     postgres://user:password@ep-cold-shadow-123456-pooler.ap-south-1.aws.neon.tech/neondb?sslmode=require
     ```

### Run Migrations & Seed to Neon Database (from your local machine):
```bash
# 1. Export Neon connection string
export DATABASE_URL="postgres://user:password@ep-cold-shadow-123456-pooler.ap-south-1.aws.neon.tech/neondb?sslmode=require"

# 2. Run Drizzle schema migrations
npm run db:migrate --workspace=backend

# 3. Populate initial test societies, roles & demo users (default password: password123)
npm run db:seed --workspace=backend
```

---

## 2. ⚡ Backend Deployment on Render / Koyeb (100% Free)

Deploy NestJS on **Render** free tier:

### Deploying on Render:
1. Sign up at [render.com](https://render.com).
2. Click **New +** -> **Web Service** -> Connect your GitHub repository.
3. Configure the Web Service settings:
   - **Name**: `society-backend`
   - **Root Directory**: *(Leave empty / root)*
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build --workspace=backend`
   - **Start Command**: `npm run start:prod --workspace=backend`
   - **Instance Type**: `Free`
4. Add **Environment Variables** in Render:
   | Key | Value / Example | Notes |
   | :--- | :--- | :--- |
   | `NODE_ENV` | `production` | Enables production security mode |
   | `PORT` | `4000` | Render automatically maps this |
   | `DATABASE_URL` | `postgres://user:pass@ep-...-pooler.neon.tech/neondb?sslmode=require` | From Neon (Pooled) |
   | `JWT_SECRET` | `generate-a-strong-random-32-char-string` | Backend JWT signing secret |
   | `FRONTEND_URL` | `https://your-frontend.vercel.app` | (Update after Vercel deploy) |
   | `DEV_AUTH` | `false` | Strictly locked in production |
   | `RAZORPAY_KEY_ID` | `rzp_test_...` or `rzp_live_...` | Optional / for payments |
   | `RAZORPAY_KEY_SECRET`| `your-razorpay-secret` | Optional / for payments |

5. Click **Create Web Service**. Render will deploy your backend and provide a public URL like:
   `https://society-backend.onrender.com`

---

## 3. ▲ Frontend Deployment on Vercel (100% Free)

1. Sign up at [vercel.com](https://vercel.com) and click **Add New...** -> **Project**.
2. Import your GitHub repository.
3. Configure Project Settings:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: `apps/frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
   - **Install Command**: `npm install`
4. Add **Environment Variables** in Vercel:
   | Key | Value | Notes |
   | :--- | :--- | :--- |
   | `NEXT_PUBLIC_API_URL` | `https://society-backend.onrender.com/api/v1` | Your Render Backend URL + `/api/v1` |

5. Click **Deploy**. Vercel will build and launch your Next.js application (e.g., `https://society-frontend.vercel.app`).

---

## 4. 🔄 Final Wiring (CORS)

1. **Update Backend CORS**:
   - Go to Render -> `society-backend` -> **Environment**.
   - Set `FRONTEND_URL` to your actual Vercel domain (e.g. `https://society-frontend.vercel.app`).
   - Click **Save Changes** (Render will redeploy).

---

## 5. 💰 Cost Breakdown (Zero Cost)

| Service | Component | Tier | Free Quota | Monthly Cost |
| :--- | :--- | :--- | :--- | :--- |
| **Neon** | PostgreSQL Database | Free Tier | 0.5 GB storage, serverless compute | **$0.00 / mo** |
| **Vercel** | Next.js Frontend | Hobby | Unlimited builds, Edge CDN, HTTPS | **$0.00 / mo** |
| **Render / Koyeb** | NestJS Backend API | Free Tier | 512 MB RAM, free web service | **$0.00 / mo** |
| **Total** | | | | **$0.00 / month** |
