import type { Scenario } from "./types";
import { envVarRegression } from "./env-var-regression";
import { connectionPool } from "./connection-pool";
import { upstreamDegradation } from "./upstream-degradation";

export const scenarios: Scenario[] = [envVarRegression, connectionPool, upstreamDegradation];

export function getScenario(id: string): Scenario | undefined {
  return scenarios.find((s) => s.id === id);
}

export type { Scenario } from "./types";
