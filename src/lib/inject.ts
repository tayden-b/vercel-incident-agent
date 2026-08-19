import { randomUUID } from "crypto";
import { db } from "@/lib/db/client";
import { incidents, logEvents } from "@/lib/db/schema";
import type { Scenario } from "@/lib/scenarios";

// Materialize a scenario into a concrete incident: real rows, real timestamps
// anchored to "now". Lines with `repeat` fan out with deterministic jitter so
// the corpus looks like production traffic but every injection of the same
// scenario is reproducible (which the eval harness depends on).

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function injectScenario(scenario: Scenario) {
  const now = Date.now();
  const incidentId = randomUUID();
  const rand = mulberry32(scenario.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0));

  const rows: (typeof logEvents.$inferInsert)[] = [];
  for (const line of scenario.logs) {
    const count = line.repeat ?? 1;
    for (let i = 0; i < count; i++) {
      // spread repeats across the two minutes after the line's anchor time
      const jitterSec = count === 1 ? 0 : Math.floor(rand() * 120);
      rows.push({
        incidentId,
        ts: now + (line.atSec + jitterSec) * 1000,
        level: line.level,
        source: line.source,
        message: line.message,
        route: line.route,
        statusCode: line.statusCode,
      });
    }
  }
  rows.sort((a, b) => a.ts - b.ts);

  await db.insert(incidents).values({
    id: incidentId,
    title: scenario.incident.title,
    status: "detected",
    scenarioId: scenario.id,
    route: scenario.incident.route,
    errorSignature: scenario.incident.errorSignature,
    eventCount: rows.length,
    firstSeenAt: rows[0].ts,
    lastSeenAt: rows[rows.length - 1].ts,
    createdAt: now,
  });
  await db.insert(logEvents).values(rows);

  return incidentId;
}
