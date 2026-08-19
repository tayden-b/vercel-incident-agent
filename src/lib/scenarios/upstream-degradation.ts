import type { Scenario } from "./types";

// No recent deploy, nothing wrong with our code: a third-party rates API is
// degraded and requests to it time out. The trap here is reflexively rolling
// back — the right move is the cached-fallback flag plus monitoring. This
// scenario exists to show the agents can decide a rollback is *wrong*.
export const upstreamDegradation: Scenario = {
  id: "upstream-degradation",
  name: "Upstream API degradation",
  blurb:
    "A third-party rates API is timing out. No recent deploy. Rolling back would do nothing — the agents have to figure that out.",
  incident: {
    title: "504s on /api/quotes: upstream timeout to api.ratesource.io",
    route: "/api/quotes",
    errorSignature: "upstream-timeout:api.ratesource.io:/api/quotes",
  },
  logs: [
    { atSec: -7200, level: "info", source: "lambda", message: "GET /api/quotes?pair=USD-EUR 200 in 310ms", route: "/api/quotes", statusCode: 200, repeat: 9 },
    { atSec: -4500, level: "info", source: "lambda", message: "GET /api/quotes?pair=USD-JPY 200 in 290ms", route: "/api/quotes", statusCode: 200, repeat: 7 },
    { atSec: -2900, level: "warning", source: "lambda", message: "GET /api/quotes?pair=USD-EUR 200 in 4820ms (slow) — upstream responded in 4650ms", route: "/api/quotes", statusCode: 200, repeat: 5 },
    { atSec: -2400, level: "error", source: "lambda", message: "FetchError: request to https://api.ratesource.io/v2/rates?base=USD failed, reason: connect ETIMEDOUT 172.64.15.20:443\n    at fetchRates (lib/rates.ts:22:15)\n    at handler (app/api/quotes/route.ts:14:22)", route: "/api/quotes", statusCode: 504, repeat: 4 },
    { atSec: -2100, level: "info", source: "lambda", message: "GET /api/orders 200 in 44ms", route: "/api/orders", statusCode: 200, repeat: 8 },
    { atSec: -1800, level: "error", source: "lambda", message: "GET /api/quotes 504 in 15012ms — upstream deadline exceeded", route: "/api/quotes", statusCode: 504, repeat: 10 },
    { atSec: -1500, level: "info", source: "lambda", message: "GET /api/products 200 in 27ms", route: "/api/products", statusCode: 200, repeat: 6 },
    { atSec: -1200, level: "error", source: "lambda", message: "FetchError: request to https://api.ratesource.io/v2/rates?base=USD failed, reason: connect ETIMEDOUT 172.64.15.20:443\n    at fetchRates (lib/rates.ts:22:15)\n    at handler (app/api/quotes/route.ts:14:22)", route: "/api/quotes", statusCode: 504, repeat: 9 },
    { atSec: -800, level: "warning", source: "lambda", message: "rates cache is stale (last refresh 41m ago) — serving would require RATES_CACHE_FALLBACK=enabled", route: "/api/quotes", repeat: 2 },
    { atSec: -300, level: "error", source: "lambda", message: "GET /api/quotes 504 in 15008ms — upstream deadline exceeded", route: "/api/quotes", statusCode: 504, repeat: 8 },
  ],
  deployment: {
    id: "dpl_9sTk4Hm6",
    sha: "c72b9d1",
    branch: "main",
    author: "tayden-b",
    message: "docs: update README deployment section",
    ageSec: 86400 * 4,
    previous: {
      id: "dpl_5rGw8Pq3",
      sha: "77aa41f",
      message: "feat: quote caching with 30m TTL",
      ageSec: 86400 * 6,
    },
  },
  diffs: [
    {
      path: "README.md",
      patch: `@@ -40,6 +40,8 @@ npm run dev
 ## Deployment

 Deployed on Vercel. Pushes to main go to production.
+
+Quotes are served from api.ratesource.io with a 30-minute cache.`,
    },
  ],
  env: {
    added: [],
    removed: [],
    present: ["DATABASE_URL", "RATESOURCE_API_KEY", "RATES_CACHE_FALLBACK", "NEXT_PUBLIC_APP_URL"],
  },
  metrics: [
    {
      name: "error_rate",
      unit: "%",
      samples: [[120, 0.2], [90, 0.3], [60, 2.1], [48, 6.8], [40, 11.2], [30, 12.4], [20, 13.1], [10, 12.8], [1, 13.3]],
    },
    {
      name: "p95_latency_ms",
      unit: "ms",
      samples: [[120, 340], [90, 360], [60, 2400], [48, 9800], [40, 15000], [30, 15000], [20, 15000], [10, 15000], [1, 15000]],
    },
  ],
  upstreams: [
    { name: "RateSource API", status: "degraded", p95LatencyMs: 14200, note: "provider status page reports elevated error rates in us-east since 13:40 UTC" },
    { name: "Postgres (Neon)", status: "operational", p95LatencyMs: 10 },
    { name: "Stripe API", status: "operational", p95LatencyMs: 250 },
  ],
  availableActions: [
    { kind: "flag_toggle", target: "RATES_CACHE_FALLBACK", description: "Serve quotes from the last-known-good cache while the upstream is degraded" },
    { kind: "rollback", target: "dpl_5rGw8Pq3", description: "Instant rollback to previous production deployment (77aa41f)" },
    { kind: "redeploy", target: "dpl_9sTk4Hm6", description: "Rebuild and redeploy the current production commit" },
    { kind: "escalate", target: "on-call", description: "Page the on-call engineer with the incident report" },
  ],
  groundTruth: {
    rootCause:
      "api.ratesource.io is degraded (provider-side, us-east). No deploy correlation — the last production deploy was 4 days ago and touched only the README. The fix is serving cached rates via RATES_CACHE_FALLBACK until the provider recovers.",
    correctActionKind: "flag_toggle",
  },
};
