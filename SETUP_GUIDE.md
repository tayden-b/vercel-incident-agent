# Vercel Incident Agent - Setup & Configuration Guide

This guide explains how to configure the Vercel Incident Agent for your portfolio, including connecting it to your Vercel projects, setting up a cost-effective AI model, and enabling email notifications.

## 1. Vercel Connection Setup

To monitor your deployments, the agent needs to authenticate with the Vercel API.

### Get your Vercel API Token
1. Go to your [Vercel Account Settings > Tokens](https://vercel.com/account/tokens).
2. Click **Create Token**.
3. Name it "Incident Agent" and select **No Expiration** (or a long duration).
4. **Copy this token immediately**. You won't see it again.
5. Set it in your `.env` file:
   ```bash
   VERCEL_TOKEN=your_token_here
   ```

### Get your Project ID
1. Navigate to the specific Vercel project you want to monitor.
2. Go to **Settings > General**.
3. Scroll down to **Project ID**.
4. Copy the ID (starts with `prj_`).
5. Set it in your `.env` file:
   ```bash
   VERCEL_PROJECT_ID=prj_...
   NEXT_PUBLIC_VERCEL_PROJECT_ID=prj_...
   ```

---

## 2. AI Model Configuration (Cost-Effective)

For a portfolio project, you don't need expensive models. We recommend **OpenAI's `gpt-4o-mini`** as it is extremely cheap and capable enough for log analysis.

1. Sign up/Login to the [OpenAI Platform](https://platform.openai.com/).
2. Go to **API Keys** and create a new key.
3. Configure your `.env`:
   ```bash
   # Use the mini model for lowest cost
   LLM_MODEL=gpt-4o-mini
   LLM_API_KEY=sk-...
   ```

---

## 3. Email Notification Setup (Gmail)

The agent uses the Gmail API to send alerts. This is the most complex part to set up due to Google's security.

### Option A: Use the Official Gmail API (Recommended for Portfolio)
The codebase is currently set up for this. You need a Google Cloud Project.

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project.
3. Enable the **Gmail API**.
4. Configure **OAuth Consent Screen** (External, Test User = your email).
5. Create **Credentials > OAuth Client ID** (Web Application).
   *   **Authorized Redirect URIs**: `https://developers.google.com/oauthplayground` (for generating the initial token).
6. Use the [OAuth 2.0 Playground](https://developers.google.com/oauthplayground) to get your `GMAIL_REFRESH_TOKEN` using your Client ID and Secret.
7. Fill in `.env`:
   ```bash
   GMAIL_CLIENT_ID=...
   GMAIL_CLIENT_SECRET=...
   GMAIL_REFRESH_TOKEN=...
   GMAIL_SENDER_EMAIL=your_email@gmail.com
   NOTIFY_TO_EMAIL=your_email@gmail.com
   ```

### Note on Demo Mode
If you skip this step, the application will **log the email content to the console** instead of crashing, so you can still demonstrate the "Email Sent" UI without actually sending emails.

---

## 4. Running the Demo

For your portfolio screenshot or recording:

1. **Start the local server:**
   ```bash
   npm run dev -- -p 3001
   ```
   *Note: We use port 3001 to avoid conflicts.*

2. **Access the Dashboard:**
   Open `http://localhost:3001`.

3. **Trigger a Manual Poll:**
   Click the **Run Poll Now** button in the top right. 
   *   *Note: In the demo version with `seed-incident.js`, mock data is already provided.*

## 5. Deployment Architecture

For your portfolio explanation, here is how the agent works:
*   **Framework**: Next.js (App Router)
*   **Database**: SQLite (Local) or LibSQL (Production/Edge) with Prisma ORM.
*   **Orchestration**: Vercel Cron Jobs trigger the analysis loop.
*   **Analysis**: 
    1. Fetches recent error logs from Vercel API.
    2. Groups them by "Error Signature".
    3. Sends the signature + sample logs to an LLM (`gpt-4o-mini`).
    4. LLM returns a structured JSON analysis (Root Cause, Fix).
    5. **Action**: Sends a structured email with "Approve Redeploy" links (using secure tokens).
