# 🤖 Vercel Incident Agent: Autonomous DevOps for Solo Developers

## Project Overview
The **Vercel Incident Agent** is an autonomous system that monitors your Vercel deployments 24/7. Instead of manually checking logs when users report issues, this agent detects errors in real-time, uses AI to analyze the root cause, and proactively suggests fixes—or even fixes them automatically with your approval.

## The Problem
For solo developers and small teams, "on-call" doesn't exist. You find out about bugs when a user complains or when you check the logs days later.
*   **Log Exhaustion**: Sifting through thousands of "Info" logs to find the one "Error".
*   **Context Switching**: Stopping development to debug production incidents.
*   **Slow Response Time**: Manual detection means downtime lasts longer.

## The Solution
An always-on agent that acts as your first line of defense.
1.  **Polls** Vercel logs automatically using Cron jobs.
2.  **Groups** similar errors into "Incidents" to reduce noise.
3.  **Analyzes** the stack trace using LLMs (GPT-4o-mini) to find the root cause.
4.  **Notifies** you via Email with a "One-Click Fix" link.
5.  **Actions** the fix (e.g., Redeploy) via the Vercel API.

---

## 🏗️ Architecture & Workflow

```mermaid
graph TD
    A[Vercel Deployment] -- Errors Generated --> B[Log Stream]
    C[Cron Job] -- Wake Up / Poll --> D[Incident Agent]
    D -- Fetch Logs --> B
    D -- New Error Found? --> E{Deduplication Engine}
    
    E -- Known Issue --> F[Update Incident Count]
    E -- New Issue --> G[Create Incident]
    
    G -- Stack Trace --> H[LLM Analysis Service]
    H -- "Here is the fix" --> I[Database (SQLite)]
    
    I -- HTML Report --> J[Gmail Service]
    J -- Send Email --> K[Developer Inbox]
    
    K -- "Approve Fix" Click --> L[Agent API]
    L -- Trigger Redeploy --> A
```

### 1. Detection Phase
The agent runs a scheduled task (Cron) every 5 minutes. It queries the Vercel API for runtime logs from your production deployment, filtering specifically for `500` status codes and `error` levels.

### 2. Intelligent Grouping
Errors are rarely unique. A single database outage can generate 10,000 logs. The agent generates a "Signature" for each error (based on the stack trace and error message) and groups them.
*   **Result*: You see **1 Incident** with 10,000 events, not 10,000 notifications.

### 3. AI Analysis
Once a new incident is created, the agent bundles the most recent error logs and sends them to OpenAI.
*   **Prompt Engineering**: The agent asks the LLM to act as a Senior DevOps Engineer.
*   **Output**: It returns a structured JSON analysis containing a **Summary**, **Likely Causes** (with confidence scores), and a **Recommended Action**.

### 4. Human-in-the-Loop Action
The agent sends an interactive email to the developer.
*   **Option A (Dismiss)**: "This is just noise/warning."
*   **Option B (Redeploy)**: "This looks like a transient memory leak. Restart."
*   **Security**: The action links contain secure, hashed tokens that expire, ensuring no one else can trigger deployments.

---

## 🛠️ Technical Stack

*   **Framework**: Next.js 14 (App Router) for both the Dashboard UI and the API/Cron backend.
*   **Database**: SQLite with Prisma ORM. Chosen for portability and zero-config local development.
*   **AI**: OpenAI API (`gpt-4o-mini`) for cost-effective, high-speed RCA (Root Cause Analysis).
*   **Integration**:
    *   **Vercel REST API**: For fetching logs and triggering deployments.
    *   **Gmail API (OAuth2)**: For sending secure, rich HTML notifications.
*   **Styling**: Tailwind CSS for a modern, responsive dashboard.

## 🚀 How It Works (The "Happy Path")
1.  You push bad code that causes a `500 Internal Server Error` on `/api/users`.
2.  Within 5 minutes, the Agent detects the error from the Vercel Log Stream.
3.  The Dashboard updates to show a new "P1 Critical" incident.
4.  The LLM analyzes the logs and determines: *"Database connection pool is exhausted."*
5.  You receive an email: *"New Incident: API Timeout. Recommended Action: Redeploy."*
6.  You click **"Approve Redeploy"** in the email.
7.  The Agent calls Vercel's API to rebuild your application, clearing the stuck connections.
8.  Incident status updates to **RESOLVED**.

## Future Improvements
*   **Slack/Discord Integration**: For team notifications.
*   **Auto-Rollback**: Automatically reverting to the previous commit if error rates spike > 5%.
*   **RAG Implementation**: Feeding your codebase to the LLM so it can pinpoint the exact line of code to fix.
