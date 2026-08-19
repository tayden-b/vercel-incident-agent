"use client";

import { useEffect, useRef } from "react";
import { clsx } from "clsx";
import type { RunView, StepView } from "@/lib/use-investigation";
import { SeverityBadge } from "@/components/badges";
import { StepLine } from "./step-line";

const roleLabels: Record<string, string> = {
  triage: "triage",
  diagnosis: "diagnosis",
  resolution: "resolution",
};

function verdictStyle(verdict: string) {
  return {
    confirmed: "border-emerald-900 bg-emerald-950/40 text-emerald-400",
    ruled_out: "border-[#333] bg-[#161616] text-[#888]",
    inconclusive: "border-yellow-900 bg-yellow-950/40 text-yellow-500",
  }[verdict];
}

// Lane result footers are role-specific: triage shows severity + hypotheses,
// diagnosis shows verdict + evidence. Resolution's report renders in the RCA
// panel instead, so its lane only shows the investigation steps.
function ResultFooter({ run }: { run: RunView }) {
  if (!run.result || typeof run.result !== "object") return null;
  const r = run.result as Record<string, unknown>;

  if (run.role === "triage") {
    const hypotheses = (r.hypotheses ?? []) as Array<{ title: string; rationale: string }>;
    return (
      <div className="border-t border-[#1f1f1f] px-3 py-2.5">
        <div className="flex items-center gap-2">
          <SeverityBadge severity={String(r.severity)} />
          <span className="font-mono text-[11px] text-[#888]">{String(r.blastRadius)}</span>
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-[#bbb]">{String(r.impactSummary)}</p>
        <div className="mt-2 space-y-1">
          {hypotheses.map((h, i) => (
            <div key={i} className="flex items-baseline gap-2 text-[12px]">
              <span className="font-mono text-[10px] text-[#666]">H{i + 1}</span>
              <span className="text-[#ddd]">{h.title}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (run.role === "diagnosis") {
    const evidence = (r.evidence ?? []) as Array<{ source: string; detail: string }>;
    return (
      <div className="border-t border-[#1f1f1f] px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span
            className={clsx(
              "inline-flex items-center rounded border px-1.5 py-px font-mono text-[11px]",
              verdictStyle(String(r.verdict)),
            )}
          >
            {String(r.verdict).replace("_", " ")}
          </span>
          <span className="font-mono text-[11px] text-[#888]">
            confidence {Number(r.confidence).toFixed(2)}
          </span>
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-[#bbb]">{String(r.reasoning)}</p>
        {evidence.length > 0 && (
          <ul className="mt-2 space-y-1">
            {evidence.slice(0, 4).map((e, i) => (
              <li key={i} className="text-[11px] leading-relaxed text-[#888]">
                <span className="font-mono text-[10px] text-[#58a6ff]">[{e.source}]</span> {e.detail}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return null;
}

export function AgentLane({ run, steps }: { run: RunView; steps: StepView[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // follow the stream while the agent is running
  useEffect(() => {
    if (run.status === "running" && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [steps.length, run.status]);

  return (
    <div className="flex flex-col overflow-hidden rounded border border-[#262626] bg-[#0e0e0e]">
      <div className="flex items-center gap-2 border-b border-[#1f1f1f] bg-[#111] px-3 py-2">
        <span
          className={clsx(
            "h-1.5 w-1.5 rounded-full",
            run.status === "running" && "live-dot bg-blue-500",
            run.status === "complete" && "bg-emerald-500",
            run.status === "error" && "bg-red-500",
          )}
        />
        <span className="font-mono text-[11px] font-medium uppercase tracking-wider text-[#aaa]">
          {roleLabels[run.role] ?? run.role}
        </span>
        {run.hypothesis && (
          <span className="truncate text-[12px] text-[#888]" title={run.hypothesis}>
            {run.hypothesis}
          </span>
        )}
      </div>
      <div ref={scrollRef} className="pane-scroll max-h-64 min-h-10 overflow-y-auto py-1">
        {steps.length === 0 && run.status === "running" && (
          <div className="px-3 py-1.5 font-mono text-[11px] text-[#555]">starting…</div>
        )}
        {steps.map((s) => (
          <StepLine key={s.seq} step={s} />
        ))}
        {run.status === "error" && (
          <div className="px-3 py-1.5 font-mono text-[11px] text-red-400">agent failed</div>
        )}
      </div>
      <ResultFooter run={run} />
    </div>
  );
}
