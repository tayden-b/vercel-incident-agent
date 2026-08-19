import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { actions, agentRuns, incidents, type Incident } from "@/lib/db/schema";
import { getScenario } from "@/lib/scenarios";
import { buildInvestigationTools } from "./tools";
import { runAgentLoop } from "./loop";
import { resolveModel } from "./model";
import { InvestigationEmitter, type InvestigationEvent } from "./events";
import {
  triageReportSchema,
  diagnosisReportSchema,
  resolutionReportSchema,
  type TriageReport,
  type DiagnosisReport,
} from "./reports";

const SYSTEM_BASE = `You are one agent in an automated incident-response pipeline for a production web application deployed on Vercel. You investigate using read-only tools. Ground every claim in tool output — cite log ids, diff paths, metric names, or upstream checks. Never invent facts. Be economical: each tool call should answer a question you actually have. When you have enough evidence, call submit_report.`;

function incidentBrief(incident: Incident) {
  return [
    `Incident: ${incident.title}`,
    `Primary route: ${incident.route ?? "unknown"}`,
    `Error signature: ${incident.errorSignature}`,
    `Log events captured: ${incident.eventCount}`,
    `First seen: ${new Date(incident.firstSeenAt).toISOString()}`,
    `Last seen: ${new Date(incident.lastSeenAt).toISOString()}`,
  ].join("\n");
}

async function createRun(incidentId: string, role: string, model: string, hypothesis?: string) {
  const id = randomUUID();
  await db.insert(agentRuns).values({
    id,
    incidentId,
    role,
    hypothesis,
    status: "running",
    model,
    startedAt: Date.now(),
  });
  return id;
}

async function finishRun(runId: string, result: unknown) {
  await db
    .update(agentRuns)
    .set({ status: "complete", result, finishedAt: Date.now() })
    .where(eq(agentRuns.id, runId));
}

async function failRun(runId: string, error: string) {
  await db
    .update(agentRuns)
    .set({ status: "error", result: { error }, finishedAt: Date.now() })
    .where(eq(agentRuns.id, runId));
}

export async function runInvestigation(
  incidentId: string,
  onEvent?: (event: InvestigationEvent & { seq: number }) => void,
) {
  const incident = await db.query.incidents.findFirst({ where: eq(incidents.id, incidentId) });
  if (!incident) throw new Error(`incident ${incidentId} not found`);
  if (!incident.scenarioId) throw new Error("live-mode incidents are not wired up yet");
  const scenario = getScenario(incident.scenarioId);
  if (!scenario) throw new Error(`unknown scenario ${incident.scenarioId}`);

  const emitter = new InvestigationEmitter(incidentId, onEvent);
  const resolved = resolveModel();
  const tools = buildInvestigationTools(incident, scenario);

  await db.update(incidents).set({ status: "investigating" }).where(eq(incidents.id, incidentId));
  await emitter.emit({ type: "pipeline_started", incidentId, model: resolved.id });
  await emitter.emit({ type: "incident_updated", patch: { status: "investigating" } });

  try {
    // ── Phase 1: triage ─────────────────────────────────────────────────
    await emitter.emit({ type: "phase_started", phase: "triage" });
    const triageRunId = await createRun(incidentId, "triage", resolved.id);
    await emitter.emit({ type: "run_started", runId: triageRunId, role: "triage" });

    let triage: TriageReport;
    try {
      triage = await runAgentLoop({
        runId: triageRunId,
        role: "triage",
        system: `${SYSTEM_BASE}\n\nYou are the TRIAGE agent. Establish scope and severity fast, then hand off. Use log_stats to see the shape of the failure, sample a few error lines, and check how recent the current deployment is. Do not attempt root-cause analysis — your job is to produce 2-3 genuinely distinct hypotheses for the diagnosis agents to investigate in parallel. Hypotheses must be distinguishable by evidence (e.g. "regression in the latest deploy" vs "upstream dependency failure"), not rewordings of each other.`,
        prompt: `${incidentBrief(incident)}\n\nTriage this incident and submit your report.`,
        tools: {
          query_logs: tools.query_logs,
          log_stats: tools.log_stats,
          get_deployment: tools.get_deployment,
          get_metrics: tools.get_metrics,
        },
        reportSchema: triageReportSchema,
        resolved,
        emitter,
      });
    } catch (err) {
      await failRun(triageRunId, String(err));
      throw err;
    }
    await finishRun(triageRunId, triage);
    await emitter.emit({ type: "run_finished", runId: triageRunId, role: "triage", result: triage });

    await db.update(incidents).set({ severity: triage.severity }).where(eq(incidents.id, incidentId));
    await emitter.emit({ type: "incident_updated", patch: { severity: triage.severity } });

    // ── Phase 2: parallel diagnosis, one agent per hypothesis ───────────
    await emitter.emit({ type: "phase_started", phase: "diagnosis" });
    const diagnoses = await Promise.all(
      triage.hypotheses.map(async (hypothesis) => {
        const runId = await createRun(incidentId, "diagnosis", resolved.id, hypothesis.title);
        await emitter.emit({ type: "run_started", runId, role: "diagnosis", hypothesis: hypothesis.title });
        try {
          const report = await runAgentLoop({
            runId,
            role: "diagnosis",
            system: `${SYSTEM_BASE}\n\nYou are a DIAGNOSIS agent. You investigate exactly one hypothesis. Look for confirming AND disconfirming evidence — ruling a hypothesis out with confidence is as valuable as confirming it. Establish the causal chain, not just correlation: if you suspect the deploy, read the diff; if you suspect an upstream, check its status and whether errors started before or after the deploy.`,
            prompt: `${incidentBrief(incident)}\n\nHypothesis to investigate: ${hypothesis.title}\nTriage rationale: ${hypothesis.rationale}\n\nInvestigate this hypothesis only, then submit your report.`,
            tools,
            reportSchema: diagnosisReportSchema,
            resolved,
            emitter,
          });
          await finishRun(runId, report);
          await emitter.emit({ type: "run_finished", runId, role: "diagnosis", result: report });
          return { hypothesis, report };
        } catch (err) {
          await failRun(runId, String(err));
          await emitter.emit({ type: "run_failed", runId, role: "diagnosis", error: String(err) });
          return { hypothesis, report: null };
        }
      }),
    );

    const completed = diagnoses.filter(
      (d): d is { hypothesis: TriageReport["hypotheses"][number]; report: DiagnosisReport } => d.report !== null,
    );
    if (completed.length === 0) throw new Error("all diagnosis agents failed");

    // ── Phase 3: resolution ─────────────────────────────────────────────
    await emitter.emit({ type: "phase_started", phase: "resolution" });
    const resolutionRunId = await createRun(incidentId, "resolution", resolved.id);
    await emitter.emit({ type: "run_started", runId: resolutionRunId, role: "resolution" });

    const diagnosisSummary = completed
      .map(
        (d) =>
          `Hypothesis: ${d.hypothesis.title}\nVerdict: ${d.report.verdict} (confidence ${d.report.confidence})\nReasoning: ${d.report.reasoning}\nEvidence:\n${d.report.evidence.map((e) => `  - [${e.source}] ${e.detail}`).join("\n")}`,
      )
      .join("\n\n");

    let resolution;
    try {
      resolution = await runAgentLoop({
        runId: resolutionRunId,
        role: "resolution",
        system: `${SYSTEM_BASE}\n\nYou are the RESOLUTION agent. You synthesize the triage and diagnosis findings into a root cause and a remediation plan. Call list_available_actions first — you may only propose actions from that list. Exactly one action is primary. Record the actions you considered and rejected, with reasons: choosing NOT to roll back is a real decision. Nothing you propose executes automatically; a human approves every action.`,
        prompt: `${incidentBrief(incident)}\n\n## Triage report\nSeverity: ${triage.severity}\nImpact: ${triage.impactSummary}\nBlast radius: ${triage.blastRadius}\n\n## Diagnosis findings\n${diagnosisSummary}\n\nSynthesize the root cause and propose a remediation plan, then submit your report.`,
        tools: {
          list_available_actions: tools.list_available_actions,
          query_logs: tools.query_logs,
          get_deploy_diff: tools.get_deploy_diff,
        },
        reportSchema: resolutionReportSchema,
        resolved,
        emitter,
      });
    } catch (err) {
      await failRun(resolutionRunId, String(err));
      throw err;
    }
    await finishRun(resolutionRunId, resolution);
    await emitter.emit({ type: "run_finished", runId: resolutionRunId, role: "resolution", result: resolution });

    const proposedActions = resolution.actions.map((a) => ({
      id: randomUUID(),
      incidentId,
      runId: resolutionRunId,
      kind: a.kind,
      title: a.title,
      detail: a.detail,
      risk: a.risk,
      status: "proposed" as const,
      createdAt: Date.now(),
    }));
    if (proposedActions.length > 0) await db.insert(actions).values(proposedActions);
    await emitter.emit({ type: "actions_proposed", actions: proposedActions });

    await db
      .update(incidents)
      .set({ status: "awaiting_approval", summary: resolution.summary })
      .where(eq(incidents.id, incidentId));
    await emitter.emit({
      type: "incident_updated",
      patch: { status: "awaiting_approval", summary: resolution.summary },
    });
    await emitter.emit({ type: "pipeline_finished", incidentId });

    return { triage, diagnoses: completed, resolution };
  } catch (err) {
    await db.update(incidents).set({ status: "detected" }).where(eq(incidents.id, incidentId));
    await emitter.emit({ type: "pipeline_failed", incidentId, error: String(err) });
    throw err;
  }
}
