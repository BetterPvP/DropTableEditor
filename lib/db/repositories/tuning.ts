import { pool } from '../client';

/**
 * Generic CRUD for the `(key, draft jsonb, published jsonb)` tuning tables.
 * Table + key-column names come from the fixed TUNING_TABLES registry (never
 * user input), so interpolating them is safe; values are always parameters.
 *
 * draft -> published: the console edits `draft`; Publish copies it to
 * `published` (which the game reads) and fires `tuning_changed`.
 */
export interface TuningRow {
  key: string;
  draft: unknown;
  published: unknown;
  unpublished: boolean;
}

export async function listTuningRows(table: string, keyColumn: string): Promise<TuningRow[]> {
  const { rows } = await pool.query(
    `SELECT ${keyColumn} AS key, draft, published FROM ${table} ORDER BY ${keyColumn}`,
  );
  return rows.map((r) => ({
    key: r.key,
    draft: r.draft,
    published: r.published,
    unpublished: JSON.stringify(r.draft) !== JSON.stringify(r.published),
  }));
}

/** Save the editor draft only — does NOT go live. */
export async function saveDraftTuningRow(table: string, keyColumn: string, key: string, draft: unknown): Promise<void> {
  await pool.query(
    `INSERT INTO ${table} (${keyColumn}, draft) VALUES ($1, $2::jsonb)
     ON CONFLICT (${keyColumn}) DO UPDATE SET draft = EXCLUDED.draft, updated_at = now()`,
    [key, JSON.stringify(draft)],
  );
}

/** Save the draft AND copy it to published (live), then signal the game. */
export async function publishTuningRow(table: string, keyColumn: string, key: string, draft: unknown): Promise<void> {
  await pool.query(
    `INSERT INTO ${table} (${keyColumn}, draft, published, published_at) VALUES ($1, $2::jsonb, $2::jsonb, now())
     ON CONFLICT (${keyColumn}) DO UPDATE
       SET draft = EXCLUDED.draft, published = EXCLUDED.draft, published_at = now(), updated_at = now()`,
    [key, JSON.stringify(draft)],
  );
  await notifyTuningChanged(table);
}

export async function deleteTuningRow(table: string, keyColumn: string, key: string): Promise<void> {
  await pool.query(`DELETE FROM ${table} WHERE ${keyColumn} = $1`, [key]);
  await notifyTuningChanged(table);
}

/** Signal the game to hot-reload its purity/rune-slot registries. */
async function notifyTuningChanged(table: string): Promise<void> {
  await pool.query(`SELECT pg_notify('tuning_changed', $1)`, [table]);
}
