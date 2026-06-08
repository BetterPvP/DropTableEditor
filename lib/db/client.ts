import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import type { Database } from './types';

/**
 * Shared Postgres pool + Kysely instance. The raw `pool` is also handed to the
 * Auth.js adapter and used for LISTEN/NOTIFY. Cached on globalThis so Next.js
 * hot-reload in dev does not open a new pool on every change.
 */
const globalForDb = globalThis as unknown as {
  __bpvpPool?: Pool;
  __bpvpDb?: Kysely<Database>;
};

export const pool =
  globalForDb.__bpvpPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
  });

export const db =
  globalForDb.__bpvpDb ??
  new Kysely<Database>({ dialect: new PostgresDialect({ pool }) });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.__bpvpPool = pool;
  globalForDb.__bpvpDb = db;
}
