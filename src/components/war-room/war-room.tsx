"use client";

import Link from "next/link";
import { ArrowLeft, Play, RotateCcw } from "lucide-react";
import { useInvestigation } from "@/lib/use-investigation";
import { SeverityBadge, StatusBadge } from "@/components/badges";
import { timeAgo } from "@/lib/format";
import { AgentLane } from "./agent-lane";
import { RcaPanel } from "./rca-panel";
import { LogViewer } from "./log-viewer";

export function WarRoom({ incidentId }: { incidentId: string }) {
  const state = useInvestigation(incidentId);
  const { incident, runs, stepsByRun, actions, logs, pipeline, model, error, loading } = state;

  if (loading) {
    return <div className="py-20 text-center font-mono text-[12px] text-[#666]">loading…</div>;
  }
  if (!incident) {
    return (
      <div className="py-20 text-center">
        <p className="text-[13px] text-[#999]">Incident not found.</p>
        <Link href="/" className="mt-2 inline-block text-[12px] text-[#58a6ff] hover:underline">
          Back to incidents
        </Link>
      </div>
    );
  }

  const triageRun = runs.find((r) => r.role === "triage");
  const diagnosisRuns = runs.filter((r) => r.role === "diagnosis");
  const resolutionRun = runs.find((r) => r.role === "resolution");
  const canInvestigate = pipeline !== "running";

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/"
          className="mb-3 inline-flex items-center gap-1 font-mono text-[11px] text-[#777] transition-colors hover:text-[#ddd]"
        >
          <ArrowLeft size={11} /> incidents
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[15px] font-semibold leading-snug tracking-tight">{incident.title}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-[#777]">
              <SeverityBadge severity={incident.severity} />
              <StatusBadge status={incident.status} />
              <span>{incident.route}</span>
              <span>{incident.eventCount} events</span>
              <span>opened {timeAgo(incident.createdAt)}</span>
              {model && <span className="text-[#555]">model: {model}</span>}
            </div>
          </div>
          <button
            onClick={() => state.investigate()}
            disabled={!canInvestigate}
            className="flex items-center gap-2 rounded border border-[#333] bg-[#161616] px-3 py-1.5 text-[13px] font-medium transition-colors hover:border-[#555] hover:bg-[#1c1c1c] disabled:cursor-default disabled:opacity-50"
          >
            {pipeline === "running" ? (
              <>
                <span className="live-dot h-1.5 w-1.5 rounded-full bg-blue-500" />
                investigating…
              </>
            ) : runs.length > 0 ? (
              <>
                <RotateCcw size={13} className="text-[#888]" /> Re-run investigation
              </>
            ) : (
              <>
                <Play size={13} className="text-emerald-500" /> Run investigation
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded border border-red-900 bg-red-950/30 px-3 py-2 font-mono text-[12px] text-red-400">
          {error}
        </div>
      )}

      {runs.length === 0 && pipeline !== "running" && (
        <div className="rounded border border-dashed border-[#333] px-6 py-10 text-center">
          <p className="text-[13px] text-[#aaa]">No investigation yet.</p>
          <p className="mx-auto mt-2 max-w-lg text-[12px] leading-relaxed text-[#666]">
            Run investigation spawns a triage agent to scope the incident, then one diagnosis agent
            per hypothesis — concurrently — then a resolution agent that synthesizes a root cause and
            proposes actions for your approval.
          </p>
        </div>
      )}

      {triageRun && <AgentLane run={triageRun} steps={stepsByRun[triageRun.id] ?? []} />}

      {diagnosisRuns.length > 0 && (
        <div>
          <div className="mb-1.5 font-mono text-[11px] text-[#666]">
            {diagnosisRuns.length} diagnosis agents · running concurrently, one per hypothesis
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            {diagnosisRuns.map((run) => (
              <AgentLane key={run.id} run={run} steps={stepsByRun[run.id] ?? []} />
            ))}
          </div>
        </div>
      )}

      {resolutionRun && <AgentLane run={resolutionRun} steps={stepsByRun[resolutionRun.id] ?? []} />}

      <RcaPanel
        resolutionRun={resolutionRun}
        actions={actions}
        onDecide={state.decide}
        isDemo={true}
      />

      {logs.length > 0 && <LogViewer logs={logs} />}
    </div>
  );
}
