import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

// Local dev uses a plain SQLite file; production points TURSO_DATABASE_URL at
// a hosted libSQL instance. Same dialect, no code changes between the two.
const url = process.env.TURSO_DATABASE_URL ?? "file:local.db";
const authToken = process.env.TURSO_AUTH_TOKEN;

const globalForDb = globalThis as unknown as { __db?: ReturnType<typeof makeDb> };

function makeDb() {
  const client = createClient(authToken ? { url, authToken } : { url });
  return drizzle(client, { schema });
}

export const db = globalForDb.__db ?? (globalForDb.__db = makeDb());
