import { tool } from "ai";
import { z } from "zod";
import { and, eq, like, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { logEvents, type Incident } from "@/lib/db/schema";
import type { Scenario } from "@/lib/scenarios";

// Read-only investigation tools. Log queries hit the incident's persisted log
// corpus in the database; deployment/env/metrics/upstream facts come from the
// data source behind the incident (a scenario fixture in demo mode, the
// Vercel API in live mode). Agents never see scenario ground truth.

function fmtTs(ts: number) {
  return new Date(ts).toISOString().slice(11, 19) + "Z";
}

export function buildInvestigationTools(incident: Incident, scenario: Scenario) {
  const now = incident.createdAt;

  const queryLogs = tool({
    description:
      "Search the incident's log corpus. Returns matching lines (newest first) with ids you can cite as evidence. Use filters to narrow: level, substring match, route.",
    inputSchema: z.object({
      level: z.enum(["info", "warning", "error"]).optional().describe("only lines at this level"),
      contains: z.string().optional().describe("case-insensitive substring to match in the message"),
      route: z.string().optional().describe("only lines for this request route"),
      limit: z.number().int().min(1).max(50).default(15),
    }),
    execute: async ({ level, contains, route, limit }) => {
      const clauses = [eq(logEvents.incidentId, incident.id)];
      if (level) clauses.push(eq(logEvents.level, level));
      if (route) clauses.push(eq(logEvents.route, route));
      if (contains) clauses.push(like(logEvents.message, `%${contains}%`));
      const rows = await db
        .select()
        .from(logEvents)
        .where(and(...clauses))
        .orderBy(sql`${logEvents.ts} desc`)
        .limit(limit);
      const [{ total }] = await db
        .select({ total: sql<number>`count(*)` })
        .from(logEvents)
        .where(and(...clauses));
      return {
        totalMatching: total,
        returned: rows.length,
        lines: rows.map((r) => ({
          id: r.id,
          time: fmtTs(r.ts),
          level: r.level,
          source: r.source,
          route: r.route,
          status: r.statusCode,
          message: r.message.length > 400 ? r.message.slice(0, 400) + "…" : r.message,
        })),
      };
    },
  });

  const logStats = tool({
    description:
      "Aggregate the incident's log corpus: counts grouped by level, route, or status code. Fast way to see the shape of the problem before reading lines.",
    inputSchema: z.object({
      groupBy: z.enum(["level", "route", "status"]),
    }),
    execute: async ({ groupBy }) => {
      const col =
        groupBy === "level" ? logEvents.level : groupBy === "route" ? logEvents.route : logEvents.statusCode;
      const rows = await db
        .select({ key: col, count: sql<number>`count(*)` })
        .from(logEvents)
        .where(eq(logEvents.incidentId, incident.id))
        .groupBy(col)
        .orderBy(sql`count(*) desc`);
      return rows.map((r) => ({ [groupBy]: r.key ?? "(none)", count: r.count }));
    },
  });

  const getDeployment = tool({
    description:
      "Get the current production deployment (id, commit, author, message, age) and the previous deployment it replaced.",
    inputSchema: z.object({}),
    execute: async () => {
      const d = scenario.deployment;
      return {
        current: {
          id: d.id,
          sha: d.sha,
          branch: d.branch,
          author: d.author,
          message: d.message,
          deployedAgoMinutes: Math.round(d.ageSec / 60),
        },
        previous: {
          id: d.previous.id,
          sha: d.previous.sha,
          message: d.previous.message,
          deployedAgoMinutes: Math.round(d.previous.ageSec / 60),
        },
      };
    },
  });

  const getDeployDiff = tool({
    description:
      "Get the code diff of the current production deployment versus the previous one. Returns changed file paths and patches.",
    inputSchema: z.object({}),
    execute: async () => ({
      commit: scenario.deployment.sha,
      files: scenario.diffs.map((f) => ({ path: f.path, patch: f.patch })),
    }),
  });

  const getEnv = tool({
    description:
      "List the environment variable NAMES configured on the project (values are never exposed), plus any vars added or removed with the current deployment.",
    inputSchema: z.object({}),
    execute: async () => scenario.env,
  });

  const getMetrics = tool({
    description:
      "Get runtime metric time series for the affected project (error_rate, p95_latency_ms, and others if instrumented). Samples are [minutesAgo, value], oldest first.",
    inputSchema: z.object({
      name: z.string().optional().describe("metric name; omit to list all available series"),
    }),
    execute: async ({ name }) => {
      const series = name ? scenario.metrics.filter((m) => m.name === name) : scenario.metrics;
      if (name && series.length === 0) {
        return { error: `no metric named '${name}'`, available: scenario.metrics.map((m) => m.name) };
      }
      return series.map((m) => {
        const values = m.samples.map(([, v]) => v);
        return {
          name: m.name,
          unit: m.unit,
          samples: m.samples,
          summary: {
            current: values[values.length - 1],
            min: Math.min(...values),
            max: Math.max(...values),
          },
        };
      });
    },
  });

  const checkUpstreams = tool({
    description:
      "Check the status of upstream/third-party dependencies this project calls (databases, external APIs): current status, p95 latency, provider notes.",
    inputSchema: z.object({}),
    execute: async () => ({ checkedAt: fmtTs(now), upstreams: scenario.upstreams }),
  });

  const listAvailableActions = tool({
    description:
      "List the remediation actions the platform can execute for this project (rollback targets, env updates, feature flags, escalation). Proposed actions must come from this list.",
    inputSchema: z.object({}),
    execute: async () => scenario.availableActions,
  });

  return {
    query_logs: queryLogs,
    log_stats: logStats,
    get_deployment: getDeployment,
    get_deploy_diff: getDeployDiff,
    get_env: getEnv,
    get_metrics: getMetrics,
    check_upstreams: checkUpstreams,
    list_available_actions: listAvailableActions,
  };
}

export type InvestigationTools = ReturnType<typeof buildInvestigationTools>;
