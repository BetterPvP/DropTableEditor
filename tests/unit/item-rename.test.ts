import { describe, expect, it } from 'vitest';
import {
  applyItemRenamesToDefinition,
  previewRegexRename,
  validateItemRenames,
} from '@/lib/items/rename';
import type { LootTableDefinition } from '@/lib/loot-tables/types';

function createDefinition(): LootTableDefinition {
  return {
    id: 'table-1',
    name: 'Temple Cache',
    description: 'Sample table',
    notes: '',
    replacementStrategy: 'UNSET',
    rollStrategy: { type: 'CONSTANT', rolls: 1 },
    weightDistribution: 'STATIC',
    pityRules: [],
    awardStrategy: { type: 'DEFAULT' },
    entries: [
      {
        id: 'entry-1',
        type: 'dropped_item',
        weight: 10,
        replacementStrategy: 'UNSET',
        itemId: 'minecraft:diamond',
        minYield: 1,
        maxYield: 2,
      },
      {
        id: 'entry-2',
        type: 'given_coin',
        weight: 1,
        replacementStrategy: 'UNSET',
        coinType: 'BAR',
        minAmount: 1,
        maxAmount: 1,
      },
    ],
    guaranteed: [
      {
        id: 'entry-3',
        type: 'given_item',
        weight: 1,
        replacementStrategy: 'UNSET',
        itemId: 'minecraft:emerald',
        minYield: 1,
        maxYield: 1,
      },
    ],
    inputs: [],
    version: 3,
    updated_at: '2026-04-07T00:00:00.000Z',
  };
}

describe('item rename helpers', () => {
  it('detects duplicate final IDs across selected and unselected items', () => {
    const result = validateItemRenames(
      ['minecraft:diamond', 'minecraft:emerald', 'minecraft:gold_ingot'],
      [{ from: 'minecraft:diamond', to: 'minecraft:emerald' }],
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error).toContain('Duplicate target ID');
  });

  it('builds regex rename previews and filters unchanged results', () => {
    const preview = previewRegexRename(
      ['minecraft:diamond', 'minecraft:diamond_block'],
      'diamond',
      'ruby',
    );
    const validation = validateItemRenames(
      ['minecraft:diamond', 'minecraft:diamond_block', 'minecraft:emerald'],
      preview.renames,
    );

    expect(preview.changedCount).toBe(2);
    expect(validation.ok).toBe(true);
    if (!validation.ok) {
      return;
    }

    expect(validation.renames).toEqual([
      { from: 'minecraft:diamond', to: 'minecraft:ruby' },
      { from: 'minecraft:diamond_block', to: 'minecraft:ruby_block' },
    ]);
  });

  it('propagates item ID changes through weighted and guaranteed loot', () => {
    const definition = createDefinition();
    const renamed = applyItemRenamesToDefinition(definition, [
      { from: 'minecraft:diamond', to: 'minecraft:netherite_ingot' },
      { from: 'minecraft:emerald', to: 'minecraft:amethyst_shard' },
    ]);

    expect(renamed.entries[0]).toMatchObject({ itemId: 'minecraft:netherite_ingot' });
    expect(renamed.guaranteed[0]).toMatchObject({ itemId: 'minecraft:amethyst_shard' });
    expect(renamed.entries[1]).toMatchObject({ coinType: 'BAR' });
  });
});
