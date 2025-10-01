import {
  LootEntry,
  LootTableDefinition,
  PityRule,
  ProgressiveConfig,
  SimulationResult,
  SimulationResultEntrySource,
  SimulationTimelineEventType,
} from './types';

type Rng = () => number;

type SimulationEntry = LootEntry & {
  baseWeight: number;
  currentWeight: number;
  removed: boolean;
};

function createRng(seed: number): Rng {
  let state = seed || Date.now();
  return () => {
    state ^= state << 13;
    state ^= state >> 17;
    state ^= state << 5;
    return (state >>> 0) / 0xffffffff;
  };
}

function randomInt(rng: Rng, min: number, max: number) {
  if (max <= min) return min;
  return Math.floor(rng() * (max - min + 1)) + min;
}

function resolveReplacement(
  entry: LootEntry,
  tableStrategy: LootTableDefinition['replacementStrategy'],
) {
  return entry.replacementStrategy === 'UNSET' ? tableStrategy : entry.replacementStrategy;
}

function getRollCount(strategy: LootTableDefinition['rollStrategy'], rng: Rng) {
  switch (strategy.type) {
    case 'CONSTANT':
      return Math.max(0, strategy.rolls);
    case 'PROGRESSIVE':
      return Math.min(strategy.maxRolls, strategy.baseRolls + randomInt(rng, 0, strategy.rollIncrement));
    case 'RANDOM':
      return randomInt(rng, strategy.min, strategy.max);
    default:
      return 0;
  }
}

function adjustProgressiveWeights(
  entries: SimulationEntry[],
  config?: ProgressiveConfig,
) {
  if (!config) return;
  const active = entries.filter((entry) => !entry.removed);
  if (active.length === 0) return;
  const average = active.reduce((sum, entry) => sum + entry.currentWeight, 0) / active.length;
  for (const entry of active) {
    const delta = average - entry.currentWeight;
    let shift = delta * config.shiftFactor;
    if (config.varianceScaling) {
      const spread = Math.abs(delta);
      const scale = average === 0 ? 1 : spread / (average || 1);
      shift *= scale;
    }
    if (config.maxShift > 0) {
      shift = Math.min(config.maxShift, Math.max(-config.maxShift, shift));
    }
    entry.currentWeight = Math.max(0, entry.currentWeight + shift);
  }
}

function pickEntry(entries: SimulationEntry[], rng: Rng): SimulationEntry | null {
  const available = entries.filter((entry) => !entry.removed && entry.currentWeight > 0);
  if (available.length === 0) return null;
  const total = available.reduce((sum, entry) => sum + entry.currentWeight, 0);
  const threshold = rng() * total;
  let cumulative = 0;
  for (const entry of available) {
    cumulative += entry.currentWeight;
    if (threshold <= cumulative) {
      return entry;
    }
  }
  return available[available.length - 1] ?? null;
}

function computePityWeight(baseWeight: number, rule: PityRule | undefined, missCount: number) {
  if (!rule) return baseWeight;
  if (missCount < rule.maxAttempts) return baseWeight;
  const increments = Math.floor(missCount / rule.maxAttempts);
  return baseWeight + increments * rule.weightIncrement;
}

function applyPityAdjustments(
  entries: SimulationEntry[],
  pityRules: Record<string, PityRule>,
  pityMisses: Record<string, number>,
) {
  for (const entry of entries) {
    if (entry.removed) {
      entry.currentWeight = 0;
      continue;
    }
    const rule = pityRules[entry.id];
    const missCount = pityMisses[entry.id] ?? 0;
    entry.currentWeight = computePityWeight(entry.baseWeight, rule, missCount);
  }
}

interface SimulationOptions {
  definition: LootTableDefinition;
  runs: number;
  seed?: number;
  onProgress?: (completed: number, total: number) => void;
}

export function simulateLootTable({ definition, runs, seed, onProgress }: SimulationOptions): SimulationResult {
  const rng = createRng(seed ?? Date.now());
  const pityLookup = Object.fromEntries(definition.pityRules.map((rule) => [rule.entryId, rule]));
  const results = new Map<
    string,
    {
      entry: LootEntry;
      source: SimulationResultEntrySource;
      totalDrops: number;
      rollHits: number;
      bundleHits: number;
      firstAppearance: number | null;
      firstRun: number | null;
      timeline: {
        rollIndex: number;
        run: number;
        type: SimulationTimelineEventType;
        quantity?: number;
      }[];
    }
  >();
  const totalRollsByRun: number[] = [];

  const start = Date.now();
  let globalRollIndex = 0;

  for (let run = 0; run < runs; run += 1) {
    const pityMisses: Record<string, number> = {};
    const runHits = new Set<string>();
    const entries: SimulationEntry[] = definition.entries.map((entry) => ({
      ...entry,
      baseWeight: entry.weight,
      currentWeight: entry.weight,
      removed: false,
    }));

    for (const guaranteedEntry of definition.guaranteed) {
      const quantity = randomInt(rng, guaranteedEntry.minYield, guaranteedEntry.maxYield);
      const existing =
        results.get(guaranteedEntry.id) ?? {
          entry: { ...guaranteedEntry },
          source: 'guaranteed' as SimulationResultEntrySource,
          totalDrops: 0,
          rollHits: 0,
          bundleHits: 0,
          firstAppearance: null as number | null,
          firstRun: null as number | null,
          timeline: [] as {
            rollIndex: number;
            run: number;
            type: SimulationTimelineEventType;
            quantity?: number;
          }[],
        };
      existing.totalDrops += quantity;
      existing.rollHits += 1;
      existing.bundleHits += 1;
      if (existing.firstRun === null) {
        existing.firstRun = run + 1;
      }
      existing.timeline.push({
        rollIndex: 0,
        run,
        type: 'granted',
        quantity,
      });
      results.set(guaranteedEntry.id, existing);
    }

    const rolls = getRollCount(definition.rollStrategy, rng);
    totalRollsByRun.push(rolls);

    for (let i = 0; i < rolls; i += 1) {
      if (definition.weightDistribution === 'PROGRESSIVE') {
        adjustProgressiveWeights(entries, definition.progressive);
      } else if (definition.weightDistribution === 'PITY') {
        applyPityAdjustments(entries, pityLookup, pityMisses);
      }

      const selected = pickEntry(entries, rng);
      if (!selected) break;

      const quantity = randomInt(rng, selected.minYield, selected.maxYield);
      const { baseWeight: _baseWeight, currentWeight: _currentWeight, removed: _removed, ...entrySnapshot } = selected;
      const existing =
        results.get(selected.id) ?? {
          entry: { ...entrySnapshot },
          source: 'weighted' as SimulationResultEntrySource,
          totalDrops: 0,
          rollHits: 0,
          bundleHits: 0,
          firstAppearance: null as number | null,
          firstRun: null as number | null,
          timeline: [] as {
            rollIndex: number;
            run: number;
            type: SimulationTimelineEventType;
            quantity?: number;
          }[],
        };
      existing.totalDrops += quantity;
      existing.rollHits += 1;
      if (existing.firstRun === null) {
        existing.firstRun = run + 1;
      }
      if (!runHits.has(selected.id)) {
        existing.bundleHits += 1;
        runHits.add(selected.id);
      }
      if (existing.firstAppearance === null) {
        existing.firstAppearance = globalRollIndex + 1;
        existing.timeline.push({
          rollIndex: globalRollIndex + 1,
          run,
          type: 'appeared',
        });
      }
      existing.timeline.push({
        rollIndex: globalRollIndex + 1,
        run,
        type: 'rolled',
        quantity,
      });
      results.set(selected.id, existing);

      if (definition.weightDistribution === 'PITY') {
        pityMisses[selected.id] = 0;
        selected.currentWeight = selected.baseWeight;
        for (const entry of entries) {
          if (entry.id !== selected.id && !entry.removed) {
            pityMisses[entry.id] = (pityMisses[entry.id] ?? 0) + 1;
          }
        }
      }

      const replacement = resolveReplacement(selected, definition.replacementStrategy);
      if (replacement === 'WITHOUT_REPLACEMENT') {
        selected.removed = true;
        selected.currentWeight = 0;
        const timelineEntry = results.get(selected.id);
        if (timelineEntry) {
          timelineEntry.timeline.push({
            rollIndex: globalRollIndex + 1,
            run,
            type: 'consumed',
          });
        }
      }

      globalRollIndex += 1;
    }

    onProgress?.(run + 1, runs);
  }

  const totalRolls = totalRollsByRun.reduce((sum, count) => sum + count, 0);
  const resultEntries = Array.from(results.entries()).map(([entryId, payload]) => ({
    entryId,
    type: payload.entry.type,
    totalDrops: payload.totalDrops,
    minYield: payload.entry.minYield,
    maxYield: payload.entry.maxYield,
    itemId: payload.entry.itemId,
    firstAppearedAt: payload.firstAppearance,
    firstRunAppearance: payload.firstRun,
    probability:
      payload.source === 'guaranteed'
        ? 1
        : totalRolls > 0
          ? payload.rollHits / totalRolls
          : 0,
    perRunAverage: payload.totalDrops / runs,
    rollHits: payload.rollHits,
    bundleHits: payload.bundleHits,
    timeline: payload.timeline,
    source: payload.source,
  }));

  return {
    runs,
    durationMs: Date.now() - start,
    totalRolls,
    entries: resultEntries,
  };
}
