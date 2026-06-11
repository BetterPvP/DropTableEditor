import { pool } from '../client';

export interface QuestNpcRow {
  id: string;
  displayName: string;
  source: string; // 'factory' | 'human'
  factory: string | null;
  type: string | null;
  skinValue: string | null;
  skinSignature: string | null;
}

export interface FactoryOption {
  factory: string;
  type: string;
}

export async function listQuestNpcs(): Promise<QuestNpcRow[]> {
  const { rows } = await pool.query(
    `SELECT id, display_name, source, factory, type, skin_value, skin_signature
     FROM quest_npcs ORDER BY id`,
  );
  return rows.map((r) => ({
    id: r.id,
    displayName: r.display_name,
    source: r.source,
    factory: r.factory,
    type: r.type,
    skinValue: r.skin_value,
    skinSignature: r.skin_signature,
  }));
}

export async function upsertQuestNpc(npc: QuestNpcRow): Promise<void> {
  await pool.query(
    `INSERT INTO quest_npcs (id, display_name, source, factory, type, skin_value, skin_signature)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO UPDATE SET
       display_name = $2, source = $3,
       factory = $4, type = $5, skin_value = $6, skin_signature = $7, updated_at = now()`,
    [npc.id, npc.displayName, npc.source, npc.factory, npc.type, npc.skinValue, npc.skinSignature],
  );
}

export async function deleteQuestNpc(id: string): Promise<void> {
  await pool.query(`DELETE FROM quest_npcs WHERE id = $1`, [id]);
}

export async function listFactories(): Promise<FactoryOption[]> {
  const { rows } = await pool.query(`SELECT factory, type FROM game_npc_factories ORDER BY factory, type`);
  return rows.map((r) => ({ factory: r.factory, type: r.type }));
}
