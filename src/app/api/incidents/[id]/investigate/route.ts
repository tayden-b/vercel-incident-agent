import { NextRequest } from "next/server";
import { runInvestigation } from "@/lib/agents/orchestrator";

export const maxDuration = 300;

// Kicks off the multi-agent investigation and streams every pipeline event
// back as SSE. Events are also persisted, so a dropped connection only loses
// liveness — the war room reloads from the database.
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
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
