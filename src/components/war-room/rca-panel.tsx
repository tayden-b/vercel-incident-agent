"use client";

import { useState } from "react";
import type { ActionView, RunView } from "@/lib/use-investigation";
import { RiskLabel } from "@/components/badges";

// The resolution agent's output: root cause, RCA summary, proposed actions
// (human decision required), rejected alternatives, and what to monitor.
export function RcaPanel({
  resolutionRun,
  actions,
  onDecide,
  isDemo,
}: {
  resolutionRun: RunView | undefined;
  actions: ActionView[];
  onDecide: (actionId: string, decision: "approve" | "reject") => Promise<void>;
  isDemo: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const report =
    resolutionRun?.result && typeof resolutionRun.result === "object"
      ? (resolutionRun.result as Record<string, unknown>)
      : null;
  if (!report && actions.length === 0) return null;

  const rejected = (report?.rejectedActions ?? []) as Array<{ kind: string; why: string }>;
  const monitoring = (report?.monitoring ?? []) as string[];

  async function decide(id: string, decision: "approve" | "reject") {
    setBusy(id);
    try {
      await onDecide(id, decision);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded border border-[#262626] bg-[#0e0e0e]">
      <div className="border-b border-[#1f1f1f] bg-[#111] px-4 py-2">
        <span className="font-mono text-[11px] font-medium uppercase tracking-wider text-[#aaa]">
          root cause analysis
        </span>
      </div>

      {report && (
        <div className="border-b border-[#1f1f1f] px-4 py-3">
          <p className="text-[13px] font-medium leading-relaxed text-[#ededed]">
            {String(report.rootCause)}
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-[#999]">{String(report.summary)}</p>
        </div>
      )}

      <div className="px-4 py-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-mono text-[11px] text-[#777]">proposed actions</span>
          {isDemo && (
            <span className="font-mono text-[10px] text-[#555]">
              demo mode: approved actions execute against the scenario sandbox
            </span>
          )}
        </div>
        <div className="space-y-2">
          {actions.map((a) => (
            <div key={a.id} className="rounded border border-[#262626] bg-[#111] px-3 py-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="rounded border border-[#333] bg-[#1a1a1a] px-1.5 py-px font-mono text-[10px] text-[#bbb]">
                      {a.kind}
                    </span>
                    <span className="text-[13px] font-medium">{a.title}</span>
                    <RiskLabel risk={a.risk} />
                  </div>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-[#999]">{a.detail}</p>
                  {a.executionNote && (
                    <p className="mt-1.5 font-mono text-[11px] text-emerald-500">{a.executionNote}</p>
                  )}
                </div>
                {a.status === "proposed" ? (
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      disabled={busy !== null}
                      onClick={() => decide(a.id, "approve")}
                      className="rounded border border-emerald-900 bg-emerald-950/40 px-2.5 py-1 text-[12px] font-medium text-emerald-400 transition-colors hover:bg-emerald-950/70 disabled:opacity-50"
                    >
                      {busy === a.id ? "…" : "Approve"}
                    </button>
                    <button
                      disabled={busy !== null}
                      onClick={() => decide(a.id, "reject")}
                      className="rounded border border-[#333] px-2.5 py-1 text-[12px] text-[#999] transition-colors hover:border-[#555] hover:text-[#ddd] disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                ) : (
                  <span className="shrink-0 font-mono text-[11px] text-[#777]">{a.status}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {(rejected.length > 0 || monitoring.length > 0) && (
        <div className="grid gap-4 border-t border-[#1f1f1f] px-4 py-3 sm:grid-cols-2">
          {rejected.length > 0 && (
            <div>
              <span className="font-mono text-[11px] text-[#777]">considered and rejected</span>
              <ul className="mt-1.5 space-y-1.5">
                {rejected.map((r, i) => (
                  <li key={i} className="text-[12px] leading-relaxed text-[#888]">
                    <span className="font-mono text-[11px] text-[#bbb]">{r.kind}</span> — {r.why}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {monitoring.length > 0 && (
            <div>
              <span className="font-mono text-[11px] text-[#777]">monitor after remediation</span>
              <ul className="mt-1.5 space-y-1.5">
                {monitoring.map((m, i) => (
                  <li key={i} className="text-[12px] leading-relaxed text-[#888]">
                    {m}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
