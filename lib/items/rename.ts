import { lootTableDefinitionSchema, type LootTableDefinition, type LootEntry } from '@/lib/loot-tables/types';

export interface ItemRenamePair {
  from: string;
  to: string;
}

export interface ItemRenameConflict {
  targetId: string;
  sourceIds: string[];
}

export interface RegexRenamePreview {
  renames: ItemRenamePair[];
  changedCount: number;
}

function renameLootEntries(entries: LootEntry[], renameMap: Map<string, string>) {
  let changed = false;

  const nextEntries = entries.map((entry) => {
    if (entry.type !== 'dropped_item' && entry.type !== 'given_item' && entry.type !== 'fish') {
      return entry;
    }

    const nextItemId = renameMap.get(entry.itemId);
    if (!nextItemId || nextItemId === entry.itemId) {
      return entry;
    }

    changed = true;
    return {
      ...entry,
      itemId: nextItemId,
    };
  });

  return { changed, entries: nextEntries };
}

export function previewRegexRename(itemIds: string[], findPattern: string, replaceValue: string): RegexRenamePreview {
  const regex = new RegExp(findPattern, 'g');
  const renames = itemIds.map((itemId) => ({
    from: itemId,
    to: itemId.replace(regex, replaceValue),
  }));

  return {
    renames,
    changedCount: renames.filter((rename) => rename.from !== rename.to).length,
  };
}

export function findItemRenameConflict(allItemIds: string[], renames: ItemRenamePair[]): ItemRenameConflict | null {
  const renameMap = new Map(renames.map((rename) => [rename.from, rename.to]));
  const ownersByFinalId = new Map<string, string[]>();

  for (const itemId of allItemIds) {
    const finalId = renameMap.get(itemId) ?? itemId;
    const owners = ownersByFinalId.get(finalId) ?? [];
    owners.push(itemId);
    ownersByFinalId.set(finalId, owners);
  }

  for (const [targetId, sourceIds] of ownersByFinalId) {
    if (sourceIds.length > 1) {
      return { targetId, sourceIds };
    }
  }

  return null;
}

export function validateItemRenames(allItemIds: string[], renames: ItemRenamePair[]) {
  if (renames.length === 0) {
    return { ok: false as const, error: 'Select at least one item to rename.' };
  }

  const uniqueSourceIds = new Set<string>();
  for (const rename of renames) {
    if (!rename.from.trim()) {
      return { ok: false as const, error: 'Source item ID is required.' };
    }

    if (uniqueSourceIds.has(rename.from)) {
      return { ok: false as const, error: `Duplicate source item ID: ${rename.from}` };
    }

    uniqueSourceIds.add(rename.from);

    if (!rename.to.trim()) {
      return { ok: false as const, error: `Item ${rename.from} would be renamed to an empty ID.` };
    }
  }

  const conflict = findItemRenameConflict(allItemIds, renames);
  if (conflict) {
    return {
      ok: false as const,
      error: `Duplicate target ID detected: ${conflict.targetId}`,
      conflict,
    };
  }

  return {
    ok: true as const,
    renames: renames.filter((rename) => rename.from !== rename.to),
  };
}

export function applyItemRenamesToDefinition(
  definition: LootTableDefinition,
  renames: ItemRenamePair[],
): LootTableDefinition {
  if (renames.length === 0) {
    return definition;
  }

  const renameMap = new Map(renames.map((rename) => [rename.from, rename.to]));
  const nextEntries = renameLootEntries(definition.entries, renameMap);
  const nextGuaranteed = renameLootEntries(definition.guaranteed, renameMap);

  if (!nextEntries.changed && !nextGuaranteed.changed) {
    return definition;
  }

  return {
    ...definition,
    entries: nextEntries.entries,
    guaranteed: nextGuaranteed.entries,
  };
}

export function parseLootTableDefinitionForRename(definition: unknown, fallback: Partial<LootTableDefinition>) {
  return lootTableDefinitionSchema.parse({
    ...(typeof definition === 'object' && definition ? definition : {}),
    ...fallback,
  });
}
