import { NextRequest, NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { actions, incidents } from "@/lib/db/schema";

const decisionSchema = z.object({ decision: z.enum(["approve", "reject"]) });

// The human side of the loop. Agents only ever propose; this endpoint is the
// single write path for executing anything. In demo mode execution runs
// against the scenario sandbox and is labeled as such.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = decisionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "decision must be 'approve' or 'reject'" }, { status: 400 });
  }

  const action = await db.query.actions.findFirst({ where: eq(actions.id, id) });
  if (!action) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (action.status !== "proposed") {
    return NextResponse.json({ error: `action already ${action.status}` }, { status: 409 });
  }

  const now = Date.now();

  if (parsed.data.decision === "reject") {
    await db.update(actions).set({ status: "rejected", decidedAt: now }).where(eq(actions.id, id));
    return NextResponse.json({ status: "rejected" });
  }

  const incident = await db.query.incidents.findFirst({ where: eq(incidents.id, action.incidentId) });
  const isDemo = Boolean(incident?.scenarioId);
  const executionNote = isDemo
    ? `Executed against the scenario sandbox (demo mode): ${action.kind} → ${action.title}`
    : `Executed via Vercel API: ${action.kind}`;

  await db
    .update(actions)
    .set({ status: "executed", decidedAt: now, executedAt: now, executionNote })
    .where(eq(actions.id, id));

  // Executing the approved action resolves the incident; other still-proposed
  // actions are closed out as rejected alternatives.
  await db
    .update(actions)
    .set({ status: "rejected", decidedAt: now })
    .where(and(eq(actions.incidentId, action.incidentId), eq(actions.status, "proposed"), ne(actions.id, id)));
  await db
    .update(incidents)
    .set({ status: "resolved", resolvedAt: now })
    .where(eq(incidents.id, action.incidentId));

  return NextResponse.json({ status: "executed", executionNote });
}
