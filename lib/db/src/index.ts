import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const poolOptions = {
  connectionString: process.env.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 3000,
  idleTimeoutMillis: 30000,
  query_timeout: 5000,
  statement_timeout: 5000,
};
// Owner connection is for schema/seed administration and isolated test fixtures only.
export const pool = new Pool(poolOptions);
export const db = drizzle(pool, { schema });

export const databaseRoles = {
  api: "phishing_api",
  review: "phishing_review",
  history: "phishing_history",
} as const;

// Applied by PostgreSQL before the first query, not an asynchronous connect hook.
// Missing roles or membership fail closed. Each process should use its own
// dedicated login with membership in ONLY its required NOLOGIN role.
export function createRoleDatabase(role: typeof databaseRoles[keyof typeof databaseRoles]) {
  const rolePool = new Pool({ ...poolOptions, allowExitOnIdle: true, options: `-c role=${role}` });
  return { pool: rolePool, db: drizzle(rolePool, { schema }) };
}

const api = createRoleDatabase(databaseRoles.api);
const review = createRoleDatabase(databaseRoles.review);
const history = createRoleDatabase(databaseRoles.history);
export const apiDb = api.db;
export const apiPool = api.pool;
export const reviewDb = review.db;
export const historyDb = history.db;
export async function closeDatabasePools() {
  await Promise.all([pool.end(), api.pool.end(), review.pool.end(), history.pool.end()]);
}

export * from "./schema";
