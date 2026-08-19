// End-to-end smoke test: inject a scenario, run the full investigation
// pipeline against the configured model, print the event stream.
//   npx tsx scripts/smoke.ts [scenarioId]
import { getScenario, scenarios } from "../src/lib/scenarios";
import { injectScenario } from "../src/lib/inject";
import { runInvestigation } from "../src/lib/agents/orchestrator";

async function main() {
  const scenarioId = process.argv[2] ?? "env-var-regression";
  const scenario = getScenario(scenarioId);
  if (!scenario) {
    console.error(`unknown scenario '${scenarioId}'. available: ${scenarios.map((s) => s.id).join(", ")}`);
    process.exit(1);
  }

  console.log(`[smoke] injecting scenario: ${scenario.name}`);
  const incidentId = await injectScenario(scenario);
  console.log(`[smoke] incident ${incidentId}`);

  const t0 = Date.now();
  const result = await runInvestigation(incidentId, (e) => {
    const at = ((Date.now() - t0) / 1000).toFixed(1).padStart(5);
    if (e.type === "step") {
      const p = e.payload as Record<string, unknown>;
      if (e.stepType === "reasoning") console.log(`${at}s  [${e.runId.slice(0, 8)}] thought: ${String(p.text).slice(0, 120)}`);
      else if (e.stepType === "tool_call") console.log(`${at}s  [${e.runId.slice(0, 8)}] → ${p.tool} ${JSON.stringify(p.input)}`);
      else console.log(`${at}s  [${e.runId.slice(0, 8)}] ← ${p.tool}`);
    } else {
      console.log(`${at}s  ${e.type}${"role" in e ? ` (${e.role}${"hypothesis" in e && e.hypothesis ? `: ${e.hypothesis}` : ""})` : ""}`);
    }
  });

  console.log("\n[smoke] === TRIAGE ===");
  console.log(JSON.stringify(result.triage, null, 2));
  console.log("\n[smoke] === DIAGNOSES ===");
  for (const d of result.diagnoses) {
    console.log(`- ${d.hypothesis.title}: ${d.report.verdict} (${d.report.confidence})`);
  }
  console.log("\n[smoke] === RESOLUTION ===");
  console.log(JSON.stringify(result.resolution, null, 2));
  console.log(`\n[smoke] ground truth: ${scenario.groundTruth.rootCause}`);
  console.log(`[smoke] expected primary action kind: ${scenario.groundTruth.correctActionKind}`);
  console.log(`[smoke] done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

main().catch((err) => {
  console.error("[smoke] FAILED:", err);
  process.exit(1);
});
