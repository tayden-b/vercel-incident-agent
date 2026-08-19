import { NextResponse } from "next/server";
import { scenarios } from "@/lib/scenarios";

// Ground truth stays server-side — the client (and the agents) only see the
// catalog entries.
export async function GET() {
  return NextResponse.json(
    scenarios.map((s) => ({ id: s.id, name: s.name, blurb: s.blurb })),
  );
}
