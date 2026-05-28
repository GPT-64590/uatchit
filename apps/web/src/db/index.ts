import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/lib/env";
import * as schema from "./schema";

const globalForPool = globalThis as unknown as { _pgPool?: Pool };

const pool =
  globalForPool._pgPool ??
  new Pool({ connectionString: env.DATABASE_URL });

if (process.env.NODE_ENV !== "production") {
  globalForPool._pgPool = pool;
}

export const db = drizzle({ client: pool, schema });
export type DB = typeof db;
