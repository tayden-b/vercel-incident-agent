import { clsx } from "clsx";

const severityStyles: Record<string, string> = {
  P0: "border-red-900 bg-red-950/40 text-red-400",
  P1: "border-orange-900 bg-orange-950/40 text-orange-400",
  P2: "border-yellow-900 bg-yellow-950/40 text-yellow-500",
  P3: "border-[#333] bg-[#161616] text-[#888]",
};

export function SeverityBadge({ severity }: { severity: string | null }) {
  if (!severity) return <span className="font-mono text-[11px] text-[#555]">—</span>;
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded border px-1.5 py-px font-mono text-[11px] font-medium",
        severityStyles[severity] ?? severityStyles.P3,
      )}
    >
      {severity}
    </span>
  );
}

const statusMeta: Record<string, { label: string; dot: string; live?: boolean }> = {
  detected: { label: "detected", dot: "bg-[#888]" },
  investigating: { label: "investigating", dot: "bg-blue-500", live: true },
  awaiting_approval: { label: "awaiting approval", dot: "bg-amber-500" },
  resolved: { label: "resolved", dot: "bg-emerald-500" },
  dismissed: { label: "dismissed", dot: "bg-[#555]" },
};

export function StatusBadge({ status }: { status: string }) {
  const meta = statusMeta[status] ?? { label: status, dot: "bg-[#888]" };
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[#aaa]">
      <span className={clsx("h-1.5 w-1.5 rounded-full", meta.dot, meta.live && "live-dot")} />
      {meta.label}
    </span>
  );
}

const riskStyles: Record<string, string> = {
  low: "text-emerald-500",
  medium: "text-amber-500",
  high: "text-red-400",
};

export function RiskLabel({ risk }: { risk: string }) {
  return (
    <span className={clsx("font-mono text-[11px]", riskStyles[risk] ?? "text-[#888]")}>
      {risk} risk
    </span>
  );
}
