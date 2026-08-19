"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Zap } from "lucide-react";

interface ScenarioEntry {
  id: string;
  name: string;
  blurb: string;
}

// Injects a scenario as a new incident. Scenarios are synthetic but the
// agents that investigate them are not — same pipeline either way.
export function ScenarioLauncher() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [scenarios, setScenarios] = useState<ScenarioEntry[]>([]);
  const [launching, setLaunching] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/scenarios")
      .then((r) => r.json())
      .then(setScenarios)
      .catch(() => setScenarios([]));
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function launch(id: string) {
    setLaunching(id);
    try {
      const res = await fetch("/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId: id }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { incidentId } = await res.json();
      router.push(`/incidents/${incidentId}`);
    } finally {
      setLaunching(null);
      setOpen(false);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded border border-[#333] bg-[#161616] px-3 py-1.5 text-[13px] font-medium transition-colors hover:border-[#555] hover:bg-[#1c1c1c]"
      >
        <Zap size={13} className="text-amber-500" />
        Inject incident
        <ChevronDown size={13} className="text-[#666]" />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1.5 w-96 rounded border border-[#333] bg-[#111] p-1 shadow-xl shadow-black/50">
          {scenarios.length === 0 && (
            <div className="px-3 py-2 font-mono text-[11px] text-[#666]">loading scenarios…</div>
          )}
          {scenarios.map((s) => (
            <button
              key={s.id}
              disabled={launching !== null}
              onClick={() => launch(s.id)}
              className="block w-full rounded px-3 py-2 text-left transition-colors hover:bg-[#1c1c1c] disabled:opacity-50"
            >
              <div className="text-[13px] font-medium">
                {launching === s.id ? "injecting…" : s.name}
              </div>
              <div className="mt-0.5 text-[12px] leading-snug text-[#888]">{s.blurb}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
