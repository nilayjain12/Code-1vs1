# 🚀 Code 1vs1 — Production Deployment Guide ($0/month)

This guide will take your local Code 1vs1 app and make it live on the internet using only free services.

## Architecture

```
User's Browser
      │
      ▼
┌──────────────┐    HTTPS     ┌──────────────────┐    TCP/SSL    ┌──────────────┐
│   Vercel     │ ──────────▶  │   Render          │ ───────────▶ │  Neon.tech   │
│  (Frontend)  │              │  (Node.js API)    │              │ (PostgreSQL) │
│  React/Vite  │ ◀────────── │  Express+Socket   │              │  Free Tier   │
└──────────────┘   JSON/WS    │                    │              └──────────────┘
                              │  Judge0 calls ─────┼──▶ RapidAPI (Code Execution)
                              └──────────────────┘
```

| Service | What it hosts | Free Tier Limits | URL |
|---------|---------------|------------------|-----|
| **Vercel** | React frontend | 100GB bandwidth/month | [vercel.com](https://vercel.com) |
| **Render** | Node.js backend + Socket.io | 750 hours/month, spins down after 15 min idle | [render.com](https://render.com) |
| **Neon** | PostgreSQL database | 500 MB storage, auto-suspend after 5 min | [neon.tech](https://neon.tech) |
| **RapidAPI** | Judge0 code execution | 50 requests/day (Basic plan) | [rapidapi.com](https://rapidapi.com) |

> [!IMPORTANT]
> All services are **$0/month** with no credit card required for the free tier.

---

## Prerequisites

Before you start, make sure you have:
- [ ] A [GitHub](https://github.com) account
- [ ] Your Code 1vs1 project pushed to a GitHub repository
- [ ] Node.js installed locally (for testing)

---

## Step 1: Push Code to GitHub

If you haven't already, push your code to a GitHub repository.

```bash
cd "c:\Users\adem-\OneDrive\Desktop\Nilay Jain\Projects\Code-1vs1"
git init
git add .
git commit -m "Initial commit - ready for deployment"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/Code-1vs1.git
git push -u origin main
```

> [!TIP]
> Create a `.gitignore` in your project root with:
> ```
> node_modules/
> .env
> server/prisma/dev.db
> server/prisma/dev.db-journal
> ```

---

## Step 2: Set Up Neon.tech Database

### 2.1 Create Account
1. Go to [neon.tech](https://neon.tech)
2. Click **"Sign Up"** → Sign in with GitHub (easiest)
3. You'll land on the Neon Dashboard

### 2.2 Create a Project
1. Click **"New Project"**
2. **Project Name:** `code-1vs1`
3. **Region:** Pick the one closest to you (e.g., `US East` or `Europe West`)
4. **PostgreSQL Version:** Leave default (16)
5. Click **"Create Project"**

### 2.3 Copy Your Connection String
After creation, Neon will show your connection details:

```
postgresql://neondb_owner:aBcDeFgHiJ@ep-cool-darkness-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
```

> [!CAUTION]
> **Copy this string and save it somewhere safe!** This is your `DATABASE_URL`. It contains your password. Never commit it to Git.

---

## Step 3: Set Up Judge0 on RapidAPI

### 3.1 Create RapidAPI Account
1. Go to [rapidapi.com](https://rapidapi.com)
2. Sign up for a free account

### 3.2 Subscribe to Judge0 CE
1. Go to the Judge0 CE page: [Judge0 CE on RapidAPI](https://rapidapi.com/judge0-official/api/judge0-ce)
2. Click **"Pricing"** tab
3. Select the **"Basic"** plan → Click **"Subscribe"** (it's $0/month)
4. After subscribing, go to the **"Endpoints"** tab
5. On the right side panel, find **`X-RapidAPI-Key`** — this is your API key

### 3.3 Copy Your API Key
The key looks like: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9`

> [!IMPORTANT]
> Save this key — you'll paste it into Render as `JUDGE0_API_KEY`.

---

## Step 4: Deploy Backend on Render

### 4.1 Create Render Account
1. Go to [render.com](https://render.com)
2. Click **"Get Started for Free"** → Sign in with GitHub

### 4.2 Create a New Web Service
1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub repo: **"Code-1vs1"**
3. Fill in the configuration:

| Setting | Value |
|---------|-------|
| **Name** | `code-1vs1-api` |
| **Region** | Same region as your Neon database |
| **Branch** | `main` |
| **Root Directory** | `server` |
| **Runtime** | `Node` |
| **Build Command** | `npm install && npx prisma generate && npx prisma db push` |
| **Start Command** | `npm start` |
| **Instance Type** | `Free` |

> [!NOTE]
> **Build Command breakdown:**
> - `npm install` — installs all dependencies
> - `npx prisma generate` — generates the Prisma Client
> - `npx prisma db push` — creates/updates all tables in your Neon database

### 4.3 Add Environment Variables
Scroll down to **"Environment Variables"** and add these one by one:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | `postgresql://neondb_owner:xxxxx@ep-xxxxx.aws.neon.tech/neondb?sslmode=require` *(your Neon string)* |
| `JWT_SECRET` | *(make up a random 32+ character string, e.g.* `x8kf92mzLp3qRtYnW7vJ` *)* |
| `JWT_REFRESH_SECRET` | *(another random 32+ character string)* |
| `JUDGE0_API_URL` | `https://judge0-ce.p.rapidapi.com` |
| `JUDGE0_API_KEY` | *(your RapidAPI key from Step 3)* |
| `ALLOWED_ORIGINS` | *(leave blank for now — we'll fill in the Vercel URL after Step 5)* |
| `NODE_ENV` | `production` |

### 4.4 Deploy
1. Click **"Create Web Service"**
2. Wait 2–5 minutes for the first build to complete
3. Once deployed, your backend URL will be: `https://code-1vs1-api.onrender.com`

### 4.5 Verify Backend is Running
Visit `https://code-1vs1-api.onrender.com/api/health` in your browser. You should see:
```json
{ "status": "ok", "uptime": 12.345 }
```

> [!NOTE]
> **Cold Starts:** On the free tier, Render spins down your service after 15 minutes of inactivity. The first request after that takes ~30–60 seconds. This is expected and there is no workaround on the free tier.

---

## Step 5: Deploy Frontend on Vercel

### 5.1 Create Vercel Account
1. Go to [vercel.com](https://vercel.com)
2. Click **"Sign Up"** → Sign in with GitHub

### 5.2 Import Your Project
1. Click **"Add New..."** → **"Project"**
2. Select your **Code-1vs1** GitHub repository
3. Vercel will auto-detect a Vite project

### 5.3 Configure the Project

| Setting | Value |
|---------|-------|
| **Project Name** | `code-1vs1` |
| **Framework Preset** | `Vite` (auto-detected) |
| **Root Directory** | Click **"Edit"** → type `client` → Click **"Continue"** |
| **Build Command** | `npm run build` *(auto-detected)* |
| **Output Directory** | `dist` *(auto-detected)* |

### 5.4 Add Environment Variables
Click **"Environment Variables"** and add:

| Key | Value |
|-----|-------|
| `VITE_API_URL` | `https://code-1vs1-api.onrender.com` *(your Render URL from Step 4)* |
| `VITE_SOCKET_URL` | `https://code-1vs1-api.onrender.com` *(same URL)* |

### 5.5 Deploy
1. Click **"Deploy"**
2. Wait 1–2 minutes
3. Your frontend URL will be: `https://code-1vs1.vercel.app` (or similar)

### 5.6 Verify Frontend is Running
Visit your Vercel URL. You should see the Code 1vs1 landing page with the retro arcade theme.

---

## Step 6: Connect Frontend ↔ Backend (CORS)

Now that both are live, you need to tell the backend to accept requests from the Vercel frontend.

1. Go to your **Render Dashboard** → Select your `code-1vs1-api` service
2. Click **"Environment"** on the left sidebar
3. Find `ALLOWED_ORIGINS` and set its value to your Vercel URL:
   ```
   https://code-1vs1.vercel.app
   ```
   *(Use your exact Vercel URL, no trailing slash)*
4. Click **"Save Changes"**
5. Render will automatically redeploy

---

## Step 7: End-to-End Testing

After both services are redeployed, test the full flow:

### Checklist
- [ ] **Landing Page** loads at your Vercel URL
- [ ] **Register** a new account → should succeed
- [ ] **Login** with that account → should redirect to Dashboard
- [ ] **Dashboard** shows correct stats (0 wins, 0 losses for new user)
- [ ] **Leaderboard** loads
- [ ] **Profile** page shows user data
- [ ] **Edit Profile** — change avatar, bio, favorite language
- [ ] **Join Queue** → get matched with a bot
- [ ] **Submit JavaScript code** → should execute via Node.js VM (no Judge0 needed)
- [ ] **Submit Python/C++/Java code** → should execute via Judge0 RapidAPI
- [ ] **Win a match** → streak and stats update correctly
- [ ] **WebSocket connection** — real-time features work (timer, submit notifications)

> [!TIP]
> Open the browser's **Developer Console** (F12 → Console tab) to check for errors. Common issues:
> - `CORS error` → Check that `ALLOWED_ORIGINS` on Render matches your Vercel URL exactly
> - `502 Bad Gateway` → Backend is still cold-starting, wait 30 seconds and try again
> - `Socket connection error` → Make sure `VITE_SOCKET_URL` is correct

---

## Troubleshooting

### "CORS error" in browser console
**Cause:** Backend doesn't recognize the frontend's origin.
**Fix:** On Render → Environment → set `ALLOWED_ORIGINS` to your exact Vercel URL (e.g., `https://code-1vs1.vercel.app`). No trailing slash. Redeploy.

### "502 Bad Gateway" or slow first load
**Cause:** Render free tier spins down after 15 min of inactivity.
**Fix:** Wait 30–60 seconds. The server is waking up. This is a free-tier limitation.

### "Judge0 error: 401 Unauthorized"
**Cause:** Missing or invalid RapidAPI key.
**Fix:** On Render → Environment → verify `JUDGE0_API_KEY` is your correct RapidAPI key and `JUDGE0_API_URL` is `https://judge0-ce.p.rapidapi.com`.

### "Judge0 error: 429 Too Many Requests"
**Cause:** You've hit the 50 requests/day limit on Judge0 Basic plan.
**Fix:** Wait until the next day, or upgrade to a paid RapidAPI plan. JavaScript code runs via the built-in Node.js VM and is not affected by this limit.

### "Database connection error"
**Cause:** Invalid Neon connection string.
**Fix:** On Render → Environment → verify `DATABASE_URL` is your exact Neon connection string including `?sslmode=require` at the end.

### "Prisma error: Table does not exist"
**Cause:** Database schema wasn't pushed.
**Fix:** On Render → go to **Shell** tab → run `npx prisma db push`. Or redeploy (the build command includes `npx prisma db push`).

### Frontend shows blank page
**Cause:** Vite environment variables aren't set correctly.
**Fix:** On Vercel → Settings → Environment Variables → verify `VITE_API_URL` and `VITE_SOCKET_URL` are set. **Redeploy** the frontend after changing env vars (Vercel → Deployments → click "..." → Redeploy).

### WebSocket won't connect
**Cause:** Socket.io needs to connect to the Render backend URL.
**Fix:** Check `VITE_SOCKET_URL` on Vercel is correct. Also ensure Render's `ALLOWED_ORIGINS` includes your Vercel URL.

---

## Maintenance & Updates

### Deploying Code Changes
Both Vercel and Render auto-deploy when you push to the `main` branch:
```bash
git add .
git commit -m "your changes"
git push origin main
```
Vercel rebuilds the frontend, Render rebuilds the backend. Takes 1–3 minutes each.

### Database Migrations
If you change `schema.prisma`, the build command (`npx prisma db push`) will automatically apply the changes on the next deploy.

### Monitoring
- **Render:** Dashboard → Logs (real-time server logs)
- **Vercel:** Dashboard → Functions → Logs
- **Neon:** Dashboard → Monitoring (query stats, storage usage)

### Cost Monitoring
All services show usage in their dashboards. You will never be charged unless you explicitly upgrade to a paid plan.

---

## Environment Variables Summary

### Render (Backend)
| Variable | Example Value |
|----------|---------------|
| `DATABASE_URL` | `postgresql://neondb_owner:abc123@ep-cool-darkness-123456.us-east-2.aws.neon.tech/neondb?sslmode=require` |
| `JWT_SECRET` | `x8kf92mzLp3qRtYnW7vJ4bM6cD1eF9gH` |
| `JWT_REFRESH_SECRET` | `a2bR7tYp4mKs9wXz6jL3nQ5vU8cE1fG0h` |
| `JUDGE0_API_URL` | `https://judge0-ce.p.rapidapi.com` |
| `JUDGE0_API_KEY` | `a1b2c3d4e5f6g7h8i9j0k1l2m3n4` |
| `ALLOWED_ORIGINS` | `https://code-1vs1.vercel.app` |
| `NODE_ENV` | `production` |

### Vercel (Frontend)
| Variable | Example Value |
|----------|---------------|
| `VITE_API_URL` | `https://code-1vs1-api.onrender.com` |
| `VITE_SOCKET_URL` | `https://code-1vs1-api.onrender.com` |

---

## 🎉 You're Done!

Your Code 1vs1 application is now live on the internet. Share your Vercel URL with friends and start battling!
