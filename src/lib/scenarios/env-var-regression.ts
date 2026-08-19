import type { Scenario } from "./types";

// A config refactor renamed an env var in code, but the Vercel project env
// was never updated. Every request to the webhook route dies at module init.
// Rollback would work, but the better fix is adding the renamed var — the
// resolution agent has to weigh both.
export const envVarRegression: Scenario = {
  id: "env-var-regression",
  name: "Env var regression after deploy",
  blurb:
    "A config refactor renamed an environment variable in code but not in project settings. Webhooks 500 on cold start.",
  incident: {
    title: "500s on /api/webhooks/stripe: missing PAYMENTS_WEBHOOK_SECRET",
    route: "/api/webhooks/stripe",
    errorSignature: "missing-env:PAYMENTS_WEBHOOK_SECRET:/api/webhooks/stripe",
  },
  logs: [
    { atSec: -3600, level: "info", source: "lambda", message: "POST /api/webhooks/stripe 200 in 84ms", route: "/api/webhooks/stripe", statusCode: 200, repeat: 6 },
    { atSec: -2400, level: "info", source: "lambda", message: "GET /api/orders 200 in 41ms", route: "/api/orders", statusCode: 200, repeat: 8 },
    { atSec: -1320, level: "info", source: "build", message: "Deployment dpl_4vXq9Kc2 promoted to production (feat: unify payments config loading)" },
    { atSec: -1290, level: "error", source: "lambda", message: "Error: Missing required environment variable: PAYMENTS_WEBHOOK_SECRET\n    at loadPaymentsConfig (lib/config.ts:31:11)\n    at <module init> (app/api/webhooks/stripe/route.ts:8:24)", route: "/api/webhooks/stripe", statusCode: 500, repeat: 3 },
    { atSec: -1260, level: "error", source: "lambda", message: "POST /api/webhooks/stripe 500 in 12ms — unhandled exception during module initialization", route: "/api/webhooks/stripe", statusCode: 500, repeat: 9 },
    { atSec: -1100, level: "warning", source: "lambda", message: "Stripe webhook delivery retry detected (evt_3PqXAb2eZvKYlo2C, attempt 3)", route: "/api/webhooks/stripe" },
    { atSec: -900, level: "error", source: "lambda", message: "Error: Missing required environment variable: PAYMENTS_WEBHOOK_SECRET\n    at loadPaymentsConfig (lib/config.ts:31:11)\n    at <module init> (app/api/webhooks/stripe/route.ts:8:24)", route: "/api/webhooks/stripe", statusCode: 500, repeat: 7 },
    { atSec: -880, level: "info", source: "lambda", message: "GET /api/orders 200 in 38ms", route: "/api/orders", statusCode: 200, repeat: 7 },
    { atSec: -640, level: "info", source: "lambda", message: "GET /api/products 200 in 22ms", route: "/api/products", statusCode: 200, repeat: 5 },
    { atSec: -600, level: "error", source: "lambda", message: "POST /api/webhooks/stripe 500 in 9ms — unhandled exception during module initialization", route: "/api/webhooks/stripe", statusCode: 500, repeat: 12 },
    { atSec: -240, level: "error", source: "lambda", message: "Error: Missing required environment variable: PAYMENTS_WEBHOOK_SECRET\n    at loadPaymentsConfig (lib/config.ts:31:11)\n    at <module init> (app/api/webhooks/stripe/route.ts:8:24)", route: "/api/webhooks/stripe", statusCode: 500, repeat: 5 },
    { atSec: -120, level: "warning", source: "lambda", message: "Stripe webhook delivery retry detected (evt_3PqXAb2eZvKYlo2C, attempt 7) — Stripe will disable this endpoint after repeated failures", route: "/api/webhooks/stripe" },
  ],
  deployment: {
    id: "dpl_4vXq9Kc2",
    sha: "e3f81a2",
    branch: "main",
    author: "tayden-b",
    message: "feat: unify payments config loading",
    ageSec: 1320,
    previous: {
      id: "dpl_8mNc3Xw1",
      sha: "b91c440",
      message: "fix: order pagination off-by-one",
      ageSec: 86400 * 2,
    },
  },
  diffs: [
    {
      path: "lib/config.ts",
      patch: `@@ -24,12 +24,14 @@ export function loadDbConfig() {
-// Stripe webhook verification
-export function loadStripeConfig() {
-  const secret = process.env.STRIPE_WEBHOOK_SECRET;
-  if (!secret) throw new Error("Missing required environment variable: STRIPE_WEBHOOK_SECRET");
-  return { webhookSecret: secret };
+// All payment-provider config now flows through one loader so we can add
+// PayPal webhooks without a third copy of this code.
+export function loadPaymentsConfig() {
+  const secret = process.env.PAYMENTS_WEBHOOK_SECRET;
+  if (!secret) throw new Error("Missing required environment variable: PAYMENTS_WEBHOOK_SECRET");
+  return { webhookSecret: secret };
 }`,
    },
    {
      path: "app/api/webhooks/stripe/route.ts",
      patch: `@@ -5,7 +5,7 @@ import { verifySignature } from "@/lib/stripe";
-import { loadStripeConfig } from "@/lib/config";
+import { loadPaymentsConfig } from "@/lib/config";

-const config = loadStripeConfig();
+const config = loadPaymentsConfig();`,
    },
  ],
  env: {
    added: [],
    removed: [],
    present: ["DATABASE_URL", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "NEXT_PUBLIC_APP_URL"],
  },
  metrics: [
    {
      name: "error_rate",
      unit: "%",
      samples: [[60, 0.2], [45, 0.1], [30, 0.3], [22, 14.8], [15, 16.2], [10, 15.1], [5, 17.4], [1, 16.8]],
    },
    {
      name: "p95_latency_ms",
      unit: "ms",
      samples: [[60, 210], [45, 195], [30, 220], [22, 180], [15, 175], [10, 190], [5, 185], [1, 180]],
    },
  ],
  upstreams: [
    { name: "Stripe API", status: "operational", p95LatencyMs: 240 },
    { name: "Postgres (Neon)", status: "operational", p95LatencyMs: 12 },
  ],
  availableActions: [
    { kind: "rollback", target: "dpl_8mNc3Xw1", description: "Instant rollback to previous production deployment (b91c440)" },
    { kind: "env_update", target: "PAYMENTS_WEBHOOK_SECRET", description: "Add or update a project environment variable, then redeploy" },
    { kind: "redeploy", target: "dpl_4vXq9Kc2", description: "Rebuild and redeploy the current production commit" },
    { kind: "escalate", target: "on-call", description: "Page the on-call engineer with the incident report" },
  ],
  groundTruth: {
    rootCause:
      "Deploy e3f81a2 renamed STRIPE_WEBHOOK_SECRET to PAYMENTS_WEBHOOK_SECRET in code; the project env still only defines the old name, so the webhook route throws at module init.",
    correctActionKind: "env_update",
  },
};
