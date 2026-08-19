import { NextRequest, NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { incidents } from "@/lib/db/schema";
import { getScenario } from "@/lib/scenarios";
import { injectScenario } from "@/lib/inject";

export async function GET() {
  const rows = await db.select().from(incidents).orderBy(desc(incidents.createdAt)).limit(50);
  return NextResponse.json(rows);
}

const createSchema = z.object({ scenarioId: z.string() });

export async function POST(req: NextRequest) {
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "scenarioId is required" }, { status: 400 });
  }
  const scenario = getScenario(parsed.data.scenarioId);
  if (!scenario) {
    return NextResponse.json({ error: `unknown scenario: ${parsed.data.scenarioId}` }, { status: 404 });
  }
  const incidentId = await injectScenario(scenario);
  return NextResponse.json({ incidentId }, { status: 201 });
}
