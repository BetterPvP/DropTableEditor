import { db } from '../client';

/**
 * Read-only access to the game manifest tables. These describe live game state
 * (items, zones, npcs, professions, primitives) the console references but does
 * not own. Used for editor autocomplete and publish-time reference validation.
 */

export interface GameItem {
  key: string;
  display_name: string;
  source: 'vanilla' | 'custom';
  material: string | null;
  tags: string[];
}

/**
 * @param limit Cap the result count. Omit for no cap — full-listing callers
 *   (the items reference browser) want every row; bounded callers (editor
 *   autocomplete) should pass an explicit ceiling.
 */
export async function listItems(search?: string, limit?: number): Promise<GameItem[]> {
  let query = db.selectFrom('game_items').select(['key', 'display_name', 'source', 'material', 'tags']);
  if (search && search.trim()) {
    const term = `%${search.trim().toLowerCase()}%`;
    query = query.where((eb) =>
      eb.or([
        eb(eb.fn('lower', ['key']), 'like', term),
        eb(eb.fn('lower', ['display_name']), 'like', term),
      ]),
    );
  }
  if (limit !== undefined) query = query.limit(limit);
  const rows = await query.orderBy('key').execute();
  return rows as GameItem[];
}

export async function itemKeysExist(keys: string[]): Promise<Set<string>> {
  if (keys.length === 0) return new Set();
  const rows = await db
    .selectFrom('game_items').select('key').where('key', 'in', keys).execute();
  return new Set(rows.map((r) => r.key));
}

export async function listZones() {
  return db.selectFrom('game_zones').select(['key', 'display_name', 'world', 'tags']).orderBy('key').execute();
}

export async function listNpcs() {
  return db.selectFrom('game_npcs').select(['key', 'display_name', 'type']).orderBy('key').execute();
}

export async function listProfessions() {
  return db.selectFrom('game_professions').select(['key', 'display_name', 'max_level']).orderBy('key').execute();
}

export async function listPrimitives() {
  return db
    .selectFrom('quest_primitives')
    .select(['id', 'category', 'label', 'param_schema', 'ui'])
    .orderBy('category')
    .orderBy('label')
    .execute();
}
