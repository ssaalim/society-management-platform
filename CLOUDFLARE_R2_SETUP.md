# ☁️ Cloudflare R2 Free Tier Storage & Quota Guide

This guide contains everything you need to know about setting up and using **Cloudflare R2 Object Storage (100% Free Tier)** with **strict file size limits and automatic quota guardrails** in the Society Management Platform.

---

## 📊 1. Cloudflare R2 Free Tier Quotas

Cloudflare R2 provides a generous free tier every month:

| Metric | Monthly Free Allowance | What It Means In Practice |
| :--- | :--- | :--- |
| **Storage Capacity** | **10 GB** / month | ~2,000 to 5,000 PDF documents or ~10,000 photos |
| **Class A Operations (Writes/Uploads)** | **1,000,000** ops / month | Over **33,000 uploads every day** |
| **Class B Operations (Reads/Views)** | **10,000,000** ops / month | Over **330,000 document views every day** |
| **Egress Bandwidth (Downloads)** | **$0.00 Unlimited** | Zero bandwidth / data transfer fees |

---

## 🔒 2. Enforced File Upload Size Limits

To ensure you never exceed storage space, the platform enforces strict limits on both client-side and server-side:

| Category | File Types / Scopes | Max Allowed Size | Allowed Formats |
| :--- | :--- | :--- | :--- |
| **Images** | Society Logo, User Avatar, Bank Passbook | **2 MB** | `.jpg`, `.jpeg`, `.png`, `.webp` |
| **Documents** | Lease Agreements, Tenant NOC, Police Verification, Bye-laws, Circulars, Certificates | **5 MB** | `.pdf`, `.jpg`, `.jpeg`, `.png`, `.webp` |
| **Spreadsheets / CSV** | Member & Flat Bulk Import | **2 MB** | `.csv`, `.txt`, `.xlsx` |

> *Files exceeding these limits are blocked on the user's browser before network transmission and verified by the backend before generating pre-signed upload URLs.*

---

## 🛡️ 3. Automatic Free Tier Protection & Guardrails

The application includes **4 layers of defense** so your account never goes above the free tier:

### 1. Monthly Upload Safety Cap (Auto-Halt)
* The backend tracks upload counts in a PostgreSQL table (`storage_usage`).
* **Default Cap**: `50,000` operations/month (only **5%** of Cloudflare's 1,000,000 free limit).
* **Behavior**: If 50,000 uploads are reached in a calendar month, the backend automatically halts further uploads with:
  `429 Too Many Requests: Monthly free tier storage quota reached.`
* **Customizable**: You can adjust this threshold with the `R2_MONTHLY_UPLOAD_CAP` environment variable.

### 2. Upload Rate Limiting
* `POST /api/v1/storage/upload-url` is protected by `@Throttle({ limit: 15, ttl: 60000 })`, preventing bots or loops from making more than **15 upload requests per minute**.

### 3. Edge CDN Caching (0 Class B Read Charges)
* All uploads are stamped with `Cache-Control: public, max-age=31536000, immutable`.
* Cloudflare's Edge CDN caches viewed documents globally, meaning repeated views hit Cloudflare's CDN cache rather than R2, **consuming 0 Class B operations**.

### 4. Real-Time Storage Monitoring Endpoint
* You can check current usage anytime via:
  ```http
  GET /api/v1/storage/usage
  ```
  **Response Example**:
  ```json
  {
    "success": true,
    "data": {
      "monthKey": "2026-08",
      "uploadCount": 124,
      "totalBytes": 47395840,
      "totalMb": "45.20",
      "maxMonthlyCap": 50000,
      "percentageUsed": "0.2%"
    }
  }
  ```

---

## 🛠️ 4. Step-by-Step Cloudflare R2 Account Setup (When You Are Ready)

Follow these steps when you are ready to connect your Cloudflare account:

### Step 1: Create a Bucket
1. Sign up / Log in to [Cloudflare Dashboard](https://dash.cloudflare.com).
2. Click **R2 Object Storage** in the left sidebar.
3. Click **Create Bucket**:
   - Bucket Name: `society-documents`
   - Region: `Automatic`
   - Click **Create Bucket**.

### Step 2: Generate API Token
1. On the R2 Overview page, click **Manage R2 API Tokens** (on the right).
2. Click **Create API Token**:
   - Token Name: `society-app-r2-token`
   - Permissions: **Object Read & Write**
   - Apply to: **Specific bucket** → Select `society-documents`
   - TTL: Forever / Custom
   - Click **Create API Token**.
3. Copy and save the generated credentials:
   - **Account ID** (Shown on the R2 overview page or URL)
   - **Access Key ID**
   - **Secret Access Key**

### Step 3: (Optional) Enable Public Domain / R2.dev
1. Go to your `society-documents` bucket → **Settings** tab.
2. Under **Public Access**, enable **R2.dev subdomain** (or connect a custom domain like `cdn.yoursociety.com`).
3. Copy the public URL (e.g. `https://pub-xxxxxxxx.r2.dev`).

---

## ⚡ 5. Environment Variables Configuration

When you configure Cloudflare R2, add these environment variables to **Render** (or `.env` locally):

```env
# Cloudflare R2 Object Storage
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET_NAME=society-documents
R2_MONTHLY_UPLOAD_CAP=50000
R2_PUBLIC_URL=https://pub-xxxxxxxx.r2.dev
```

---

## 🔄 6. Local Fallback Mode (Current State)

If Cloudflare R2 credentials are not configured (like right now):
* The platform automatically detects missing keys and runs in **local fallback mode**.
* File upload URLs resolve to local backend paths with **zero crashes or errors**.
* When you add your R2 keys to Render in the future, the backend will automatically switch to Cloudflare R2 with no code changes required!
