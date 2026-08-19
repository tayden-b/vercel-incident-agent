import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { incidents } from "@/lib/db/schema";
import { SeverityBadge, StatusBadge } from "@/components/badges";
import { ScenarioLauncher } from "@/components/scenario-launcher";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Home() {
  const rows = await db.select().from(incidents).orderBy(desc(incidents.createdAt)).limit(50);

  return (
    <div>
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Incidents</h1>
          <p className="mt-1 text-[13px] text-[#888]">
            Inject a scenario, then watch triage, parallel diagnosis, and resolution agents work it.
          </p>
        </div>
        <ScenarioLauncher />
      </div>

      {rows.length === 0 ? (
        <div className="rounded border border-dashed border-[#333] px-6 py-14 text-center">
          <p className="text-[13px] text-[#aaa]">No incidents yet.</p>
          <p className="mx-auto mt-2 max-w-md text-[12px] leading-relaxed text-[#666]">
            This demo runs on synthetic incident scenarios — realistic log corpora, deploy diffs, and
            upstream statuses. The agents investigating them are real LLM tool loops. Use{" "}
            <span className="font-mono text-[11px] text-[#999]">Inject incident</span> to start one.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded border border-[#262626]">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-[#262626] bg-[#111] font-mono text-[11px] text-[#777]">
                <th className="px-3 py-2 font-medium">sev</th>
                <th className="px-3 py-2 font-medium">incident</th>
                <th className="hidden px-3 py-2 font-medium sm:table-cell">route</th>
                <th className="px-3 py-2 font-medium">status</th>
                <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">events</th>
                <th className="px-3 py-2 text-right font-medium">created</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((incident) => (
                <tr key={incident.id} className="border-b border-[#1a1a1a] last:border-0 hover:bg-[#111]">
                  <td className="px-3 py-2.5">
                    <SeverityBadge severity={incident.severity} />
                  </td>
                  <td className="max-w-md px-3 py-2.5">
                    <Link
                      href={`/incidents/${incident.id}`}
                      className="block truncate text-[13px] font-medium hover:underline"
                    >
                      {incident.title}
                    </Link>
                  </td>
                  <td className="hidden px-3 py-2.5 font-mono text-[12px] text-[#888] sm:table-cell">
                    {incident.route}
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={incident.status} />
                  </td>
                  <td className="hidden px-3 py-2.5 text-right font-mono text-[12px] text-[#888] sm:table-cell">
                    {incident.eventCount}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-[12px] text-[#888]">
                    {timeAgo(incident.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
