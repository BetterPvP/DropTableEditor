import { listItems, listZones, listProfessions } from '@/lib/db/repositories/manifest';
import { listQuestNpcs } from '@/lib/db/repositories/quest-npcs';
import { listContent } from '@/lib/db/repositories/content';
import type { ContentType } from '@/lib/db/types';

/** A selectable reference option for editor pickers. */
export interface RefOption {
  id: string;
  label: string;
}

/** Everything an editor needs to render reference dropdowns. Serializable. */
export interface EditorManifest {
  items: RefOption[];
  zones: RefOption[];
  npcs: RefOption[];
  professions: RefOption[];
  content: Record<ContentType, RefOption[]>;
}

export async function loadEditorManifest(): Promise<EditorManifest> {
  const [items, zones, npcs, professions, loot, saga, quest, conversation, cinematic] = await Promise.all([
    listItems(undefined, 1000),
    listZones(),
    listQuestNpcs(),
    listProfessions(),
    listContent('loot_table'),
    listContent('saga'),
    listContent('quest'),
    listContent('conversation'),
    listContent('cinematic'),
  ]);

  const toContent = (rows: Array<{ id: string; name: string }>): RefOption[] =>
    rows.map((r) => ({ id: r.id, label: r.name }));

  return {
    items: items.map((i) => ({ id: i.key, label: i.display_name })),
    zones: zones.map((z) => ({ id: z.key, label: z.display_name })),
    npcs: npcs.map((n) => ({ id: n.id, label: n.displayName })),
    professions: professions.map((p) => ({ id: p.key, label: p.display_name })),
    content: {
      loot_table: toContent(loot),
      saga: toContent(saga),
      quest: toContent(quest),
      conversation: toContent(conversation),
      cinematic: toContent(cinematic),
    },
  };
}
