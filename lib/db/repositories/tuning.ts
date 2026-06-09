import { pool } from '../client';

/**
 * Generic CRUD for the `(key, definition jsonb)` tuning tables. The table and
 * key-column names are NOT user input — they come from the fixed TUNING_TABLES
 * registry — so interpolating them into SQL is safe. Values are always passed as
 * parameters.
 */
export interface TuningRow {
  key: string;
  definition: unknown;
  updatedAt: Date | null;
}

export async function listTuningRows(table: string, keyColumn: string): Promise<TuningRow[]> {
  const { rows } = await pool.query(
    `SELECT ${keyColumn} AS key, definition, updated_at FROM ${table} ORDER BY ${keyColumn}`,
  );
  return rows.map((r) => ({ key: r.key, definition: r.definition, updatedAt: r.updated_at }));
}

export async function upsertTuningRow(table: string, keyColumn: string, key: string, definition: unknown): Promise<void> {
  await pool.query(
    `INSERT INTO ${table} (${keyColumn}, definition) VALUES ($1, $2::jsonb)
     ON CONFLICT (${keyColumn}) DO UPDATE SET definition = EXCLUDED.definition, updated_at = now()`,
    [key, JSON.stringify(definition)],
  );
}

export async function deleteTuningRow(table: string, keyColumn: string, key: string): Promise<void> {
  await pool.query(`DELETE FROM ${table} WHERE ${keyColumn} = $1`, [key]);
}
