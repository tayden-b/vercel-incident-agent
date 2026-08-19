import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

// An incident is one deduplicated production problem: a cluster of log events
// sharing an error signature, plus everything the agents learned about it.
export const incidents = sqliteTable(
  "incidents",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    // detected -> investigating -> awaiting_approval -> resolved | dismissed
    status: text("status").notNull().default("detected"),
    severity: text("severity"), // P0..P3, assigned by triage
    scenarioId: text("scenario_id"), // set when the incident came from a demo scenario
    route: text("route"),
    errorSignature: text("error_signature").notNull(),
    summary: text("summary"), // final RCA summary, written by the resolution agent
    eventCount: integer("event_count").notNull().default(0),
    firstSeenAt: integer("first_seen_at").notNull(),
    lastSeenAt: integer("last_seen_at").notNull(),
    createdAt: integer("created_at").notNull(),
    resolvedAt: integer("resolved_at"),
  },
  (t) => [index("incidents_status_idx").on(t.status)],
);

export const logEvents = sqliteTable(
  "log_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    incidentId: text("incident_id").notNull(),
    ts: integer("ts").notNull(),
    level: text("level").notNull(),
    source: text("source"),
    message: text("message").notNull(),
    route: text("route"),
    statusCode: integer("status_code"),
  },
  (t) => [index("log_events_incident_idx").on(t.incidentId)],
);

// One agent invocation. The pipeline creates one triage run, N parallel
// diagnosis runs (one per hypothesis), and one resolution run.
export const agentRuns = sqliteTable(
  "agent_runs",
  {
    id: text("id").primaryKey(),
    incidentId: text("incident_id").notNull(),
    role: text("role").notNull(), // triage | diagnosis | resolution
    hypothesis: text("hypothesis"), // diagnosis runs only
    status: text("status").notNull().default("running"), // running | complete | error
    model: text("model").notNull(),
    result: text("result", { mode: "json" }),
    startedAt: integer("started_at").notNull(),
    finishedAt: integer("finished_at"),
  },
  (t) => [index("agent_runs_incident_idx").on(t.incidentId)],
);

// Every observable step an agent takes: tool calls, tool results, reasoning
// text, final structured output. Persisted so a war room can be replayed
// after the live stream is gone.
export const agentSteps = sqliteTable(
  "agent_steps",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    incidentId: text("incident_id").notNull(),
    runId: text("run_id").notNull(),
    seq: integer("seq").notNull(),
    type: text("type").notNull(), // status | reasoning | tool_call | tool_result | result
    payload: text("payload", { mode: "json" }).notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    index("agent_steps_incident_idx").on(t.incidentId),
    index("agent_steps_run_idx").on(t.runId),
  ],
);

// Remediation actions proposed by the resolution agent. Nothing executes
// without a human decision — approval is the only write path.
export const actions = sqliteTable(
  "actions",
  {
    id: text("id").primaryKey(),
    incidentId: text("incident_id").notNull(),
    runId: text("run_id"),
    kind: text("kind").notNull(), // rollback | redeploy | env_update | flag_toggle | escalate
    title: text("title").notNull(),
    detail: text("detail").notNull(),
    risk: text("risk").notNull(), // low | medium | high
    status: text("status").notNull().default("proposed"), // proposed | approved | rejected | executed
    createdAt: integer("created_at").notNull(),
    decidedAt: integer("decided_at"),
    executedAt: integer("executed_at"),
    executionNote: text("execution_note"),
  },
  (t) => [index("actions_incident_idx").on(t.incidentId)],
);

export type Incident = typeof incidents.$inferSelect;
export type LogEvent = typeof logEvents.$inferSelect;
export type AgentRun = typeof agentRuns.$inferSelect;
export type AgentStep = typeof agentSteps.$inferSelect;
export type Action = typeof actions.$inferSelect;
