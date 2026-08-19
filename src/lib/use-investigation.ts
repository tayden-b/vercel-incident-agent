"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Client-side war room state. Initial state hydrates from the incident detail
// endpoint (everything is persisted); a live investigation layers SSE events
// on top of it. Reconnecting mid-run just falls back to persisted state.

export interface StepView {
  seq: number;
  type: "reasoning" | "tool_call" | "tool_result";
  payload: Record<string, unknown>;
}

export interface RunView {
  id: string;
  role: string;
  hypothesis?: string | null;
  status: "running" | "complete" | "error";
  result?: unknown;
}

export interface ActionView {
  id: string;
  kind: string;
  title: string;
  detail: string;
  risk: string;
  status: string;
  executionNote?: string | null;
}

export interface IncidentView {
  id: string;
  title: string;
  status: string;
  severity: string | null;
  route: string | null;
  errorSignature: string;
  summary: string | null;
  eventCount: number;
  firstSeenAt: number;
  lastSeenAt: number;
  createdAt: number;
}

export interface LogView {
  id: number;
  ts: number;
  level: string;
  source: string | null;
  message: string;
  route: string | null;
  statusCode: number | null;
}

export type PipelineState = "idle" | "running" | "finished" | "failed";

interface WarRoomState {
  incident: IncidentView | null;
  runs: RunView[];
  stepsByRun: Record<string, StepView[]>;
  actions: ActionView[];
  logs: LogView[];
  pipeline: PipelineState;
  model: string | null;
  error: string | null;
}

const initial: WarRoomState = {
  incident: null,
  runs: [],
  stepsByRun: {},
  actions: [],
  logs: [],
  pipeline: "idle",
  model: null,
  error: null,
};

export function useInvestigation(incidentId: string) {
  const [state, setState] = useState<WarRoomState>(initial);
  const [loading, setLoading] = useState(true);
  const streaming = useRef(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/incidents/${incidentId}`, { cache: "no-store" });
    if (!res.ok) throw new Error("failed to load incident");
    const data = await res.json();
    const stepsByRun: Record<string, StepView[]> = {};
    for (const s of data.steps) {
      (stepsByRun[s.runId] ??= []).push({ seq: s.seq, type: s.type, payload: s.payload });
    }
    setState((prev) => ({
      ...prev,
      incident: data.incident,
      runs: data.runs.map((r: RunView & { result: unknown }) => ({
        id: r.id,
        role: r.role,
        hypothesis: r.hypothesis,
        status: r.status,
        result: r.result,
      })),
      stepsByRun,
      actions: data.actions,
      logs: data.logs,
      pipeline:
        prev.pipeline === "running"
          ? "running"
          : data.runs.length > 0
            ? "finished"
            : "idle",
    }));
    setLoading(false);
  }, [incidentId]);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  const dispatch = useCallback((event: Record<string, unknown>) => {
    setState((prev) => {
      switch (event.type) {
        case "pipeline_started":
          return { ...prev, pipeline: "running", model: String(event.model), error: null };
        case "run_started": {
          const run: RunView = {
            id: String(event.runId),
            role: String(event.role),
            hypothesis: event.hypothesis ? String(event.hypothesis) : null,
            status: "running",
          };
          return { ...prev, runs: [...prev.runs, run] };
        }
        case "step": {
          const runId = String(event.runId);
          const step: StepView = {
            seq: Number(event.seq),
            type: event.stepType as StepView["type"],
            payload: event.payload as Record<string, unknown>,
          };
          return {
            ...prev,
            stepsByRun: { ...prev.stepsByRun, [runId]: [...(prev.stepsByRun[runId] ?? []), step] },
          };
        }
        case "run_finished":
          return {
            ...prev,
            runs: prev.runs.map((r) =>
              r.id === event.runId ? { ...r, status: "complete", result: event.result } : r,
            ),
          };
        case "run_failed":
          return {
            ...prev,
            runs: prev.runs.map((r) => (r.id === event.runId ? { ...r, status: "error" } : r)),
          };
        case "incident_updated":
          return {
            ...prev,
            incident: prev.incident ? { ...prev.incident, ...(event.patch as object) } : prev.incident,
          };
        case "actions_proposed":
          return { ...prev, actions: event.actions as ActionView[] };
        case "pipeline_finished":
          return { ...prev, pipeline: "finished" };
        case "pipeline_failed":
          return { ...prev, pipeline: "failed", error: String(event.error ?? "unknown error") };
        default:
          return prev;
      }
    });
  }, []);

  const investigate = useCallback(async () => {
    if (streaming.current) return;
    streaming.current = true;
    setState((prev) => ({
      ...prev,
      runs: [],
      stepsByRun: {},
      actions: [],
      pipeline: "running",
      error: null,
    }));
    try {
      const res = await fetch(`/api/incidents/${incidentId}/investigate`, { method: "POST" });
      if (!res.ok || !res.body) throw new Error(`investigation failed to start (${res.status})`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";
        for (const frame of frames) {
          const line = frame.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          try {
            dispatch(JSON.parse(line.slice(6)));
          } catch {
            // malformed frame; skip
          }
        }
      }
    } catch (err) {
      setState((prev) => ({ ...prev, pipeline: "failed", error: String(err) }));
    } finally {
      streaming.current = false;
      // reconcile with persisted state (canonical action ids, statuses)
      load().catch(() => {});
    }
  }, [incidentId, dispatch, load]);

  const decide = useCallback(
    async (actionId: string, decision: "approve" | "reject") => {
      const res = await fetch(`/api/actions/${actionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      if (!res.ok) throw new Error("decision failed");
      await load();
    },
    [load],
  );

  return { ...state, loading, investigate, decide };
}
