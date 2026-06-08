import { describe, expect, it } from 'vitest';
import {
  lootTableDefinitionSchema,
  makeDefaultLootTable,
  getEntryKey,
  computeWeightTotals,
} from '@/lib/content/loot_table/schema';

// Locks the ported loot domain model: the schema must accept the default draft
// and every loot-entry variant exactly as the previous console did. If this
// fails, drop-table parity has regressed.
describe('loot_table schema (ported parity)', () => {
  it('accepts the default factory draft', () => {
    const def = makeDefaultLootTable('abc', 'Test');
    const parsed = lootTableDefinitionSchema.safeParse(def);
    expect(parsed.success).toBe(true);
  });

  it('round-trips a full definition with all entry variants', () => {
    const definition = {
      id: 'tbl',
      name: 'Boss Loot',
      replacementStrategy: 'WITHOUT_REPLACEMENT',
      rollStrategy: { type: 'CONSTANT', rolls: 3 },
      weightDistribution: 'PITY',
      pityRules: [{ entryId: 'e1', maxAttempts: 10, weightIncrement: 5 }],
      awardStrategy: { type: 'DEFAULT' },
      entries: [
        { id: 'e1', type: 'dropped_item', itemId: 'minecraft:diamond', weight: 10, minYield: 1, maxYield: 2, replacementStrategy: 'UNSET' },
        { id: 'e2', type: 'dropped_coin', coinType: 'BAR', weight: 5, minAmount: 1, maxAmount: 3, replacementStrategy: 'UNSET' },
        { id: 'e3', type: 'dropped_clan_energy', energyType: 'SHARD', weight: 2, minAmount: 1, maxAmount: 1, autoDeposit: true, replacementStrategy: 'UNSET' },
        { id: 'e4', type: 'clan_experience', weight: 1, minXp: 50, maxXp: 100, replacementStrategy: 'UNSET' },
        { id: 'e5', type: 'fish', itemId: 'minecraft:cod', displayName: 'Cod', weight: 4, minWeight: 1, maxWeight: 5, replacementStrategy: 'UNSET' },
        { id: 'e6', type: 'entity_spawn', entityType: 'DROWNED', weight: 1, launchAtSource: true, replacementStrategy: 'UNSET' },
        { id: 'e7', type: 'dropped_item', itemId: 'x', weight: { type: 'EXPRESSION', expression: 'roll_index * 2', fallback: 1, preview: 2 }, minYield: 0, maxYield: 1, replacementStrategy: 'UNSET' },
      ],
      guaranteed: [],
      inputs: [{ key: 'luck', description: 'Player luck', defaultValue: 0 }],
      version: 1,
      updated_at: new Date(0).toISOString(),
    };

    const parsed = lootTableDefinitionSchema.safeParse(definition);
    expect(parsed.success).toBe(true);
  });

  it('derives stable entry keys and weight totals', () => {
    expect(getEntryKey({ id: 'e', type: 'entity_spawn', entityType: 'ZOMBIE', weight: 1, launchAtSource: false, replacementStrategy: 'UNSET' })).toBe('entity_spawn:ZOMBIE');
    const { totalWeight } = computeWeightTotals([
      { id: 'a', type: 'dropped_item', itemId: 'x', weight: 3, minYield: 0, maxYield: 1, replacementStrategy: 'UNSET' },
      { id: 'b', type: 'dropped_item', itemId: 'y', weight: 7, minYield: 0, maxYield: 1, replacementStrategy: 'UNSET' },
    ]);
    expect(totalWeight).toBe(10);
  });
});
