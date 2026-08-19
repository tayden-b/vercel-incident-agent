import { z } from "zod";

// Structured outputs each agent must submit to finish its run. Submission
// happens through a required tool call, so the shape is enforced at the
// model-call layer rather than parsed out of prose.

export const triageReportSchema = z.object({
  severity: z.enum(["P0", "P1", "P2", "P3"]).describe("P0 = site down / revenue stopped, P3 = cosmetic"),
  impactSummary: z.string().describe("1-2 sentences: who/what is affected and how badly"),
  affectedRoutes: z.array(z.string()),
  blastRadius: z.enum(["single-route", "multi-route", "site-wide"]),
  hypotheses: z
    .array(
      z.object({
        id: z.string().describe("short slug, e.g. 'deploy-regression'"),
        title: z.string(),
        rationale: z.string().describe("why this is plausible, citing observed evidence"),
      }),
    )
    .min(2)
    .max(3)
    .describe("distinct root-cause hypotheses worth investigating in parallel"),
});
export type TriageReport = z.infer<typeof triageReportSchema>;

export const diagnosisReportSchema = z.object({
  verdict: z.enum(["confirmed", "ruled_out", "inconclusive"]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().describe("2-4 sentences: the causal chain you established or failed to establish"),
  evidence: z
    .array(
      z.object({
        source: z.string().describe("where this came from: log ids, diff path, metric name, upstream check"),
        detail: z.string().describe("the specific fact and why it matters"),
      }),
    )
    .min(1),
});
export type DiagnosisReport = z.infer<typeof diagnosisReportSchema>;

export const resolutionReportSchema = z.object({
  rootCause: z.string().describe("the single established root cause, one sentence"),
  summary: z.string().describe("2-4 sentence RCA a human reads first: what broke, why, impact"),
  actions: z
    .array(
      z.object({
        kind: z.enum(["rollback", "redeploy", "env_update", "flag_toggle", "escalate"]),
        target: z.string(),
        title: z.string(),
        detail: z.string().describe("exactly what this does and why it is the right call"),
        risk: z.enum(["low", "medium", "high"]),
        isPrimary: z.boolean().describe("true for the single recommended action"),
      }),
    )
    .min(1)
    .max(3),
  rejectedActions: z
    .array(
      z.object({
        kind: z.string(),
        why: z.string(),
      }),
    )
    .describe("actions considered and rejected, with reasons — e.g. why a rollback would not help"),
  monitoring: z.array(z.string()).describe("what to watch after remediation to confirm recovery"),
});
export type ResolutionReport = z.infer<typeof resolutionReportSchema>;
