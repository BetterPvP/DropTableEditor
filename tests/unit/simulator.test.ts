import { describe, expect, it } from 'vitest';

import { simulateLootTable } from '@/lib/loot-tables/simulator';
import { LootTableDefinition } from '@/lib/loot-tables/types';

const baseDefinition: LootTableDefinition = {
  id: 'table',
  name: 'Test Table',
  description: undefined,
  notes: undefined,
  replacementStrategy: 'UNSET',
  rollStrategy: { type: 'CONSTANT', rolls: 60 },
  weightDistribution: 'STATIC',
  pityRules: [],
  progressive: undefined,
  entries: [
    {
      id: 'common',
      type: 'dropped_item',
      itemId: 'common',
      minYield: 1,
      maxYield: 1,
      weight: 10,
      replacementStrategy: 'UNSET',
    },
    {
      id: 'rare',
      type: 'dropped_item',
      itemId: 'rare',
      minYield: 1,
      maxYield: 1,
      weight: 1,
      replacementStrategy: 'UNSET',
    },
  ],
  guaranteed: [],
  version: 0,
  updated_at: new Date(0).toISOString(),
};

describe('simulateLootTable', () => {
  it('boosts unlucky entries when pity rules are applied', () => {
    const seed = 1337;
    const baseline = simulateLootTable({ definition: baseDefinition, runs: 1, seed });

    const pityDefinition: LootTableDefinition = {
      ...baseDefinition,
      weightDistribution: 'PITY',
      pityRules: [
        {
          entryId: 'rare',
          maxAttempts: 3,
          weightIncrement: 25,
        },
      ],
    };

    const withPity = simulateLootTable({ definition: pityDefinition, runs: 1, seed });

    const baselineRare = baseline.entries.find((entry) => entry.entryId === 'rare');
    const pityRare = withPity.entries.find((entry) => entry.entryId === 'rare');

    expect(baselineRare?.totalDrops ?? 0).toBeLessThan(pityRare?.totalDrops ?? 0);
  });
});
