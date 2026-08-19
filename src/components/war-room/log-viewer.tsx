"use client";

import { clsx } from "clsx";
import type { LogView } from "@/lib/use-investigation";
import { clockTime } from "@/lib/format";

const levelColor: Record<string, string> = {
  error: "text-red-400",
  warning: "text-yellow-500",
  info: "text-[#777]",
};

export function LogViewer({ logs }: { logs: LogView[] }) {
  return (
    <details className="rounded border border-[#262626] bg-[#0e0e0e]">
      <summary className="cursor-pointer list-none border-[#1f1f1f] bg-[#111] px-4 py-2 [&::-webkit-details-marker]:hidden">
        <span className="font-mono text-[11px] font-medium uppercase tracking-wider text-[#aaa]">
          log corpus
        </span>
        <span className="ml-2 font-mono text-[11px] text-[#666]">
          {logs.length} lines{logs.length === 200 ? " (first 200)" : ""} · what the agents query
        </span>
      </summary>
      <div className="pane-scroll max-h-96 overflow-y-auto border-t border-[#1f1f1f] px-1 py-1 font-mono text-[11px] leading-relaxed">
        {logs.map((l) => (
          <div key={l.id} className="flex gap-2 px-2 py-px hover:bg-[#111]">
            <span className="shrink-0 text-[#555]">{clockTime(l.ts)}</span>
            <span className={clsx("w-14 shrink-0", levelColor[l.level] ?? "text-[#777]")}>
              {l.level}
            </span>
            <span className="whitespace-pre-wrap break-all text-[#999]">
              {l.message.split("\n")[0]}
              {l.statusCode ? <span className="text-[#555]"> · {l.statusCode}</span> : null}
            </span>
          </div>
        ))}
      </div>
    </details>
  );
}
