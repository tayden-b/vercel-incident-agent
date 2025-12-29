# Vercel Incident Agent

An autonomous DevOps agent that monitors Vercel deployments, analyzes runtime errors using AI, and facilitates one-click fixes via secure email loops.

![Dashboard Preview](dashboard_preview.png)
*(Note: You can add a screenshot here if you have one, or remove this line)*

## Overview

This project solves the "on-call" problem for solo developers. Instead of manually digging through logs when things break, this agent acts as a always-on SRE team member. It detects critical issues in real-time, diagnoses them using LLMs, and presents you with a clear solution.

### Key Features

*   **Autopilot Monitoring**: Polls Vercel runtime logs for 500-level errors on a cron schedule.
*   **Intelligent De-duplication**: Groups thousands of log lines into distinct "Incidents" based on error signatures.
*   **AI Root Cause Analysis**: Uses GPT-4o-mini to analyze stack traces and suggest specific fixes (e.g., "Increase DB connection limit").
*   **Human-in-the-Loop**: Sends a formatted email with a "Redeploy" button. No need to open the Vercel dashboard.
*   **Secure Actions**: Email links use hashed, single-use tokens to trigger API actions safely.

## Architecture

1.  **Ingestion**: A Next.js API route (`/api/cron/poll-logs`) fetches recent logs from Vercel.
2.  **Processing**: Logs are structured, hashed, and stored in a SQLite database via Prisma.
3.  **Analysis**: New incidents trigger an LLM analysis job.
4.  **Notification**: The system generates an HTML report and emails it via Gmail API.
5.  **Resolution**: The developer clicks a link to approve the fix, triggering a Vercel redeploy via API.

## Tech Stack

*   **Core**: Next.js 14 (App Router), TypeScript
*   **Database**: SQLite + Prisma ORM
*   **AI**: OpenAI API
*   **Integrations**: Vercel SDK, Googleapis (Gmail)
*   **UI**: Tailwind CSS, Lucide Icons

## Setup

1.  **Clone & Install**:
    ```bash
    git clone https://github.com/tayden-b/vercel-incident-agent.git
    cd vercel-incident-agent
    npm install
    ```

2.  **Environment Variables**:
    Copy `.env.example` to `.env` and fill in your keys:
    *   `VERCEL_TOKEN` & `VERCEL_PROJECT_ID`: For log access.
    *   `LLM_API_KEY`: OpenAI key.
    *   `GMAIL_CLIENT_ID` etc.: For sending emails (optional, console logs used as fallback).

3.  **Run Locally**:
    ```bash
    npm run dev
    ```
    The cron job can be triggered manually at `http://localhost:3000/api/cron/poll-logs`.

## Database

This project uses a local SQLite database for simplicity.
*   `npx prisma studio`: View the data.
*   `npx prisma db push`: Sync schema changes.

## License

MIT
