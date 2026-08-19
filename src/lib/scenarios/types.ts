// A scenario is a self-contained incident fixture: the log corpus, deployment
// context, env state, metrics, and upstream statuses that the agents'
// investigation tools read from in demo mode. The agents themselves have no
// idea a scenario is behind the tools — they run the same loop either way.

export interface ScenarioLogLine {
  /** offset in seconds relative to incident injection time (negative = past) */
  atSec: number;
  level: "info" | "warning" | "error";
  source: string;
  message: string;
  route?: string;
  statusCode?: number;
  /** repeat this line N times with jittered timestamps */
  repeat?: number;
}

export interface ScenarioDeployment {
  id: string;
  sha: string;
  branch: string;
  author: string;
  message: string;
  /** seconds before injection time */
  ageSec: number;
  previous: {
    id: string;
    sha: string;
    message: string;
    ageSec: number;
  };
}

export interface ScenarioFileDiff {
  path: string;
  patch: string;
}

export interface ScenarioEnvState {
  added: string[];
  removed: string[];
  /** vars present in the project (values never included) */
  present: string[];
}

export interface ScenarioMetric {
  name: string;
  unit: string;
  /** [minutesAgo, value] samples, oldest first */
  samples: Array<[number, number]>;
}

export interface ScenarioUpstream {
  name: string;
  status: "operational" | "degraded" | "outage";
  p95LatencyMs: number;
  note?: string;
}

export interface ScenarioAction {
  kind: "rollback" | "redeploy" | "env_update" | "flag_toggle" | "escalate";
  target: string;
  description: string;
}

export interface Scenario {
  id: string;
  name: string;
  /** one-line description shown in the scenario picker */
  blurb: string;
  incident: {
    title: string;
    route: string;
    errorSignature: string;
  };
  logs: ScenarioLogLine[];
  deployment: ScenarioDeployment;
  diffs: ScenarioFileDiff[];
  env: ScenarioEnvState;
  metrics: ScenarioMetric[];
  upstreams: ScenarioUpstream[];
  availableActions: ScenarioAction[];
  /** Held out from the agents. Used for eval scoring and honest docs. */
  groundTruth: {
    rootCause: string;
    correctActionKind: ScenarioAction["kind"];
  };
}
