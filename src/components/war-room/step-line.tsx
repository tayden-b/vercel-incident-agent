import type { StepView } from "@/lib/use-investigation";

function compactJson(value: unknown, max = 90): string {
  const s = JSON.stringify(value);
  if (!s) return "";
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function summarizeOutput(tool: string, output: unknown): string {
  if (output == null) return "done";
  if (Array.isArray(output)) return `${output.length} entries`;
  if (typeof output === "object") {
    const o = output as Record<string, unknown>;
    if (tool === "query_logs" && "returned" in o) return `${o.returned} of ${o.totalMatching} matching lines`;
    if ("files" in o && Array.isArray(o.files)) return `${(o.files as unknown[]).length} changed files`;
    if ("upstreams" in o && Array.isArray(o.upstreams)) return `${(o.upstreams as unknown[]).length} upstreams`;
    return compactJson(o, 70);
  }
  return String(output).slice(0, 70);
}

export function StepLine({ step }: { step: StepView }) {
  if (step.type === "reasoning") {
    return (
      <div className="px-3 py-1.5 text-[12px] leading-relaxed text-[#999]">
        {String(step.payload.text)}
      </div>
    );
  }

  if (step.type === "tool_call") {
    return (
      <div className="flex items-baseline gap-2 px-3 py-1 font-mono text-[11px]">
        <span className="text-[#666]">→</span>
        <span className="text-[#58a6ff]">{String(step.payload.tool)}</span>
        <span className="truncate text-[#666]">{compactJson(step.payload.input)}</span>
      </div>
    );
  }

  // tool_result — collapsed by default, expandable to the full payload
  return (
    <details className="group px-3 py-1 font-mono text-[11px]">
      <summary className="flex cursor-pointer list-none items-baseline gap-2 [&::-webkit-details-marker]:hidden">
        <span className="text-[#666]">←</span>
        <span className="text-[#888]">{String(step.payload.tool)}</span>
        <span className="text-[#666]">{summarizeOutput(String(step.payload.tool), step.payload.output)}</span>
        <span className="ml-auto text-[10px] text-[#444] group-open:hidden">expand</span>
      </summary>
      <pre className="pane-scroll mt-1.5 max-h-56 overflow-auto rounded bg-[#0d0d0d] p-2 text-[10px] leading-relaxed text-[#8b949e]">
        {JSON.stringify(step.payload.output, null, 2)}
      </pre>
    </details>
  );
}
