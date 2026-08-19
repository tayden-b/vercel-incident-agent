import { db } from "@/lib/db/client";
import { agentSteps } from "@/lib/db/schema";

// Everything the pipeline does is emitted as an event. Each event is
// persisted (so a war room can be reconstructed after the fact) and forwarded
// to the live SSE stream when one is attached.

export type PipelinePhase = "triage" | "diagnosis" | "resolution";

export type InvestigationEvent =
  | { type: "pipeline_started"; incidentId: string; model: string }
  | { type: "phase_started"; phase: PipelinePhase }
  | { type: "run_started"; runId: string; role: string; hypothesis?: string }
  | { type: "step"; runId: string; stepType: "reasoning" | "tool_call" | "tool_result"; payload: unknown }
  | { type: "run_finished"; runId: string; role: string; result: unknown }
  | { type: "run_failed"; runId: string; role: string; error: string }
  | { type: "incident_updated"; patch: Record<string, unknown> }
  | { type: "actions_proposed"; actions: unknown[] }
  | { type: "pipeline_finished"; incidentId: string }
  | { type: "pipeline_failed"; incidentId: string; error: string };

export class InvestigationEmitter {
  private seq = 0;
  constructor(
    private incidentId: string,
    private onEvent?: (event: InvestigationEvent & { seq: number }) => void,
  ) {}

  async emit(event: InvestigationEvent) {
    const seq = ++this.seq;
    // Only per-agent steps go in agent_steps; lifecycle events are derivable
    // from the runs/actions tables and only matter to the live stream.
    if (event.type === "step") {
      await db.insert(agentSteps).values({
        incidentId: this.incidentId,
        runId: event.runId,
        seq,
        type: event.stepType,
        payload: event.payload,
        createdAt: Date.now(),
      });
    }
    this.onEvent?.({ ...event, seq });
  }
}
