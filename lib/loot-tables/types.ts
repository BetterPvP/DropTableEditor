import { z } from 'zod';

export const replacementStrategies = ['UNSET', 'WITH_REPLACEMENT', 'WITHOUT_REPLACEMENT'] as const;
export type ReplacementStrategy = (typeof replacementStrategies)[number];

export const lootTypes = ['dropped_item', 'given_item'] as const;
export type LootType = (typeof lootTypes)[number];

export const awardStrategyTypes = ['DEFAULT', 'LOOT_CHEST'] as const;
export type AwardStrategyType = (typeof awardStrategyTypes)[number];

export const lootChestTypes = ['BIG', 'SMALL', 'CUSTOM'] as const;
export type LootChestType = (typeof lootChestTypes)[number];

const soundEffectSchema = z.object({
  key: z.string(),
  pitch: z.number().nonnegative().default(1),
  volume: z.number().nonnegative().default(1),
});

const defaultAwardStrategySchema = z.object({
  type: z.literal('DEFAULT'),
});

const lootChestAwardStrategySchema = z.union([
  z.object({
    type: z.literal('LOOT_CHEST'),
    chestType: z.union([z.literal('BIG'), z.literal('SMALL')]),
  }),
  z.object({
    type: z.literal('LOOT_CHEST'),
    chestType: z.literal('CUSTOM'),
    mythicMobName: z.string().default(''),
    soundEffect: soundEffectSchema.default({ key: '', pitch: 1, volume: 1 }),
    dropDelay: z.number().int().nonnegative().default(0),
    dropInterval: z.number().int().nonnegative().default(0),
  }),
]);

export const awardStrategySchema = z.union([defaultAwardStrategySchema, lootChestAwardStrategySchema]);

export type AwardStrategy = z.infer<typeof awardStrategySchema>;

export const weightDistributionStrategies = ['STATIC', 'PITY', 'PROGRESSIVE'] as const;
export type WeightDistributionStrategy = (typeof weightDistributionStrategies)[number];

export const rollStrategyTypes = ['CONSTANT', 'PROGRESSIVE', 'RANDOM'] as const;
export type RollStrategyType = (typeof rollStrategyTypes)[number];

export const rollStrategySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('CONSTANT'), rolls: z.number().int().positive().default(1) }),
  z.object({
    type: z.literal('PROGRESSIVE'),
    baseRolls: z.number().int().positive(),
    rollIncrement: z.number().nonnegative(),
    maxRolls: z.number().int().positive(),
  }),
  z.object({
    type: z.literal('RANDOM'),
    min: z.number().int().nonnegative(),
    max: z.number().int().positive(),
  }),
]);

export type RollStrategy = z.infer<typeof rollStrategySchema>;

export const lootEntryBaseSchema = z.object({
  id: z.string(),
  type: z.enum(lootTypes),
  weight: z.number().nonnegative().default(0),
  replacementStrategy: z.enum(replacementStrategies).default('UNSET'),
});

export const itemLootSchema = lootEntryBaseSchema.extend({
  type: z.union([z.literal('dropped_item'), z.literal('given_item')]),
  itemId: z.string(),
  minYield: z.number().int().nonnegative().default(0),
  maxYield: z.number().int().positive().default(1),
});

export type ItemLoot = z.infer<typeof itemLootSchema>;

export type LootEntry = ItemLoot;

export const pityRuleSchema = z.object({
  entryId: z.string(),
  maxAttempts: z.number().int().positive(),
  weightIncrement: z.number().nonnegative(),
});

export type PityRule = z.infer<typeof pityRuleSchema>;

export const progressiveConfigSchema = z.object({
  maxShift: z.number().nonnegative().default(0),
  shiftFactor: z.number().nonnegative().default(0),
  varianceScaling: z.boolean().default(false),
});

export type ProgressiveConfig = z.infer<typeof progressiveConfigSchema>;

export const lootTableDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  notes: z.string().optional(),
  replacementStrategy: z.enum(replacementStrategies).default('UNSET'),
  rollStrategy: rollStrategySchema,
  weightDistribution: z.enum(weightDistributionStrategies).default('STATIC'),
  pityRules: z.array(pityRuleSchema).default([]),
  progressive: progressiveConfigSchema.optional(),
  awardStrategy: awardStrategySchema.default({ type: 'DEFAULT' }),
  entries: z.array(itemLootSchema),
  guaranteed: z.array(itemLootSchema).default([]),
  version: z.number().int().nonnegative().default(0),
  updated_at: z.string(),
});

export type LootTableDefinition = z.infer<typeof lootTableDefinitionSchema>;

export type SimulationTimelineEventType = 'appeared' | 'rolled' | 'consumed' | 'granted';

export interface SimulationTimelineEvent {
  rollIndex: number;
  run: number;
  type: SimulationTimelineEventType;
  quantity?: number;
}

export type SimulationResultEntrySource = 'weighted' | 'guaranteed';

export interface SimulationResultEntry {
  entryId: string;
  type: LootType;
  totalDrops: number;
  minYield: number;
  maxYield: number;
  itemId: string;
  firstAppearedAt: number | null;
  firstRunAppearance: number | null;
  probability: number;
  perRunAverage: number;
  rollHits: number;
  bundleHits: number;
  timeline: SimulationTimelineEvent[];
  source: SimulationResultEntrySource;
}

export interface SimulationResult {
  runs: number;
  durationMs: number;
  totalRolls: number;
  entries: SimulationResultEntry[];
}

export function computeWeightTotals(entries: LootEntry[]): { totalWeight: number; probabilities: Record<string, number> } {
  const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);
  const probabilities = Object.fromEntries(
    entries.map((entry) => [entry.id, totalWeight > 0 ? entry.weight / totalWeight : 0]),
  );
  return { totalWeight, probabilities };
}

export function ensureUniqueEntries(entries: LootEntry[]): LootEntry[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = entry.type.startsWith('dropped') || entry.type.startsWith('given') ? entry.itemId : entry.id;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
