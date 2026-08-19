import { NextRequest, NextResponse } from "next/server";
import { gte, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { agentRuns } from "@/lib/db/schema";
import { runInvestigation } from "@/lib/agents/orchestrator";

export const maxDuration = 300;

// Global spend guard for the public demo: each investigation costs real LLM
// tokens, so cap how many can start per hour across all visitors. DB-backed,
// so it holds across serverless instances.
const HOURLY_LIMIT = Number(process.env.INVESTIGATION_HOURLY_LIMIT ?? 12);

async function overHourlyLimit(): Promise<boolean> {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(agentRuns)
    .where(gte(agentRuns.startedAt, Date.now() - 60 * 60 * 1000));
  // each investigation creates ~5 runs (1 triage + up to 3 diagnosis + 1 resolution)
  return count >= HOURLY_LIMIT * 5;
}

// Kicks off the multi-agent investigation and streams every pipeline event
// back as SSE. Events are also persisted, so a dropped connection only loses
// liveness — the war room reloads from the database.
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  if (await overHourlyLimit()) {
    return NextResponse.json(
      { error: "Demo rate limit reached (investigations per hour). Try again in a bit." },
      { status: 429 },
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // client disconnected; investigation continues and persists
        }
      };
      runInvestigation(id, send)
        .catch((err) => send({ type: "pipeline_failed", incidentId: id, error: String(err) }))
        .finally(() => {
          try {
            controller.close();
          } catch {}
        });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
