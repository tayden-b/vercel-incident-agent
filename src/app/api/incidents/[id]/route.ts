import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { actions, agentRuns, agentSteps, incidents, logEvents } from "@/lib/db/schema";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const incident = await db.query.incidents.findFirst({ where: eq(incidents.id, id) });
  if (!incident) return NextResponse.json({ error: "not found" }, { status: 404 });

  const [runs, steps, proposedActions, logs] = await Promise.all([
    db.select().from(agentRuns).where(eq(agentRuns.incidentId, id)).orderBy(asc(agentRuns.startedAt)),
    db.select().from(agentSteps).where(eq(agentSteps.incidentId, id)).orderBy(asc(agentSteps.seq)),
    db.select().from(actions).where(eq(actions.incidentId, id)).orderBy(asc(actions.createdAt)),
    db.select().from(logEvents).where(eq(logEvents.incidentId, id)).orderBy(asc(logEvents.ts)).limit(200),
  ]);

  return NextResponse.json({ incident, runs, steps, actions: proposedActions, logs });
}
