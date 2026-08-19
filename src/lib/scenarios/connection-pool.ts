import type { Scenario } from "./types";

// A deploy moved Prisma client construction inside the request handler.
// Under load, every invocation opens fresh connections until the pool is
// exhausted — intermittent at first, then sustained. Correct call: rollback,
// with a code fix to follow.
export const connectionPool: Scenario = {
  id: "connection-pool",
  name: "Connection pool exhaustion",
  blurb:
    "A refactor instantiates a new database client per request. Search latency climbs until the pool is exhausted under load.",
  incident: {
    title: "Intermittent 500s on /api/search: connection pool timeout",
    route: "/api/search",
    errorSignature: "prisma-pool-timeout:/api/search",
  },
  logs: [
    { atSec: -10800, level: "info", source: "build", message: "Deployment dpl_7pQr2Vd8 promoted to production (refactor: extract search service module)" },
    { atSec: -9600, level: "info", source: "lambda", message: "GET /api/search?q=terraform 200 in 130ms", route: "/api/search", statusCode: 200, repeat: 10 },
    { atSec: -7200, level: "info", source: "lambda", message: "GET /api/search?q=vault 200 in 260ms", route: "/api/search", statusCode: 200, repeat: 8 },
    { atSec: -5400, level: "warning", source: "lambda", message: "GET /api/search?q=kubernetes 200 in 1840ms (slow)", route: "/api/search", statusCode: 200, repeat: 4 },
    { atSec: -3900, level: "error", source: "lambda", message: "PrismaClientKnownRequestError: Timed out fetching a new connection from the connection pool. (More info: http://pris.ly/d/connection-pool, Current connection pool timeout: 10, connection limit: 5)\n    at SearchService.query (lib/search/service.ts:18:20)\n    at handler (app/api/search/route.ts:12:28)", route: "/api/search", statusCode: 500, repeat: 3 },
    { atSec: -3600, level: "info", source: "lambda", message: "GET /api/search?q=nomad 200 in 3210ms (slow)", route: "/api/search", statusCode: 200, repeat: 3 },
    { atSec: -2700, level: "error", source: "lambda", message: "PrismaClientKnownRequestError: Timed out fetching a new connection from the connection pool. (More info: http://pris.ly/d/connection-pool, Current connection pool timeout: 10, connection limit: 5)\n    at SearchService.query (lib/search/service.ts:18:20)\n    at handler (app/api/search/route.ts:12:28)", route: "/api/search", statusCode: 500, repeat: 8 },
    { atSec: -2400, level: "warning", source: "db", message: "postgres: remaining connection slots reserved for superuser (97/100 connections in use)" },
    { atSec: -1800, level: "error", source: "lambda", message: "GET /api/search 500 in 10041ms", route: "/api/search", statusCode: 500, repeat: 11 },
    { atSec: -1500, level: "info", source: "lambda", message: "GET /api/orders 200 in 95ms", route: "/api/orders", statusCode: 200, repeat: 6 },
    { atSec: -1200, level: "warning", source: "db", message: "postgres: too many connections for role 'app_rw'" , repeat: 2 },
    { atSec: -700, level: "error", source: "lambda", message: "PrismaClientKnownRequestError: Timed out fetching a new connection from the connection pool. (More info: http://pris.ly/d/connection-pool, Current connection pool timeout: 10, connection limit: 5)\n    at SearchService.query (lib/search/service.ts:18:20)\n    at handler (app/api/search/route.ts:12:28)", route: "/api/search", statusCode: 500, repeat: 14 },
    { atSec: -300, level: "error", source: "lambda", message: "GET /api/search 500 in 10038ms", route: "/api/search", statusCode: 500, repeat: 9 },
  ],
  deployment: {
    id: "dpl_7pQr2Vd8",
    sha: "a4d20c7",
    branch: "main",
    author: "tayden-b",
    message: "refactor: extract search service module",
    ageSec: 10800,
    previous: {
      id: "dpl_2wEj9Bn4",
      sha: "9f13e02",
      message: "feat: search result highlighting",
      ageSec: 86400 * 3,
    },
  },
  diffs: [
    {
      path: "lib/search/service.ts",
      patch: `@@ -1,10 +1,16 @@
-import { db } from "@/lib/db"; // shared singleton PrismaClient
+import { PrismaClient } from "@prisma/client";

 export class SearchService {
+  private db: PrismaClient;
+
+  constructor() {
+    // each service instance gets its own client so tests can inject config
+    this.db = new PrismaClient();
+  }
+
   async query(term: string) {
-    return db.product.findMany({
+    return this.db.product.findMany({
       where: { name: { contains: term, mode: "insensitive" } },
       take: 50,
     });
   }
 }`,
    },
    {
      path: "app/api/search/route.ts",
      patch: `@@ -8,8 +8,9 @@ import { SearchService } from "@/lib/search/service";
 export async function GET(req: NextRequest) {
   const q = req.nextUrl.searchParams.get("q") ?? "";
-  const results = await searchService.query(q);
+  const service = new SearchService();
+  const results = await service.query(q);
   return NextResponse.json({ results });
 }`,
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
      samples: [[180, 0.1], [150, 0.2], [120, 1.4], [90, 4.2], [60, 9.8], [45, 12.3], [30, 18.9], [15, 24.1], [5, 26.7], [1, 25.9]],
    },
    {
      name: "p95_latency_ms",
      unit: "ms",
      samples: [[180, 240], [150, 410], [120, 980], [90, 2400], [60, 5100], [45, 7300], [30, 9600], [15, 10000], [5, 10000], [1, 10000]],
    },
    {
      name: "db_connections",
      unit: "count",
      samples: [[180, 14], [150, 22], [120, 41], [90, 63], [60, 82], [45, 91], [30, 97], [15, 100], [5, 100], [1, 100]],
    },
  ],
  upstreams: [
    { name: "Postgres (Neon)", status: "operational", p95LatencyMs: 11, note: "connection count at plan limit" },
    { name: "Stripe API", status: "operational", p95LatencyMs: 230 },
  ],
  availableActions: [
    { kind: "rollback", target: "dpl_2wEj9Bn4", description: "Instant rollback to previous production deployment (9f13e02)" },
    { kind: "redeploy", target: "dpl_7pQr2Vd8", description: "Rebuild and redeploy the current production commit" },
    { kind: "env_update", target: "DATABASE_URL", description: "Add or update a project environment variable, then redeploy" },
    { kind: "escalate", target: "on-call", description: "Page the on-call engineer with the incident report" },
  ],
  groundTruth: {
    rootCause:
      "Deploy a4d20c7 replaced the shared PrismaClient singleton with a per-request `new PrismaClient()` in SearchService, leaking connections until the pool (limit 5 per instance, 100 per database) is exhausted under load.",
    correctActionKind: "rollback",
  },
};
