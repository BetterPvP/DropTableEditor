/// <reference lib="webworker" />

import {
  LootEntry,
  LootTableDefinition,
  PityRule,
  ProgressiveConfig,
  SimulationResult,
  SimulationTimelineEventType,
} from '../loot-tables/types';

interface StartMessage {
  type: 'start';
  definition: LootTableDefinition;
  runs: number;
  seed?: number;
}

interface ProgressMessage {
  type: 'progress';
  completed: number;
  total: number;
}

interface CompleteMessage {
  type: 'complete';
  result: SimulationResult;
}

type WorkerMessage = StartMessage;
type WorkerResponse = ProgressMessage | CompleteMessage;

declare const self: DedicatedWorkerGlobalScope;

function createRng(seed: number) {
  let state = seed || Date.now();
  return () => {
    state ^= state << 13;
    state ^= state >> 17;
    state ^= state << 5;
    return (state >>> 0) / 0xffffffff;
  };
}

function randomInt(rng: () => number, min: number, max: number) {
  if (max <= min) return min;
  return Math.floor(rng() * (max - min + 1)) + min;
}

function resolveReplacement(entry: LootEntry, tableStrategy: LootTableDefinition['replacementStrategy']) {
  return entry.replacementStrategy === 'UNSET' ? tableStrategy : entry.replacementStrategy;
}

function getRollCount(strategy: LootTableDefinition['rollStrategy'], rng: () => number) {
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

function applyPityWeights(
  entry: LootEntry,
  pityRules: Record<string, PityRule>,
  misses: Record<string, number>,
): number {
  const rule = pityRules[entry.id];
  if (!rule) return entry.weight;
  const missCount = misses[entry.id] ?? 0;
  if (missCount < rule.maxAttempts) return entry.weight;
  const increments = Math.floor(missCount / rule.maxAttempts);
  return entry.weight + increments * rule.weightIncrement;
}

function adjustProgressiveWeights(
  entries: (LootEntry & { currentWeight: number; removed: boolean })[],
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

function pickEntry(
  entries: (LootEntry & { currentWeight: number; removed: boolean })[],
  rng: () => number,
): LootEntry | null {
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

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;
  if (message.type !== 'start') return;

  const { definition, runs } = message;
  const rng = createRng(message.seed ?? Date.now());

  const pityLookup = Object.fromEntries(definition.pityRules.map((rule) => [rule.entryId, rule]));
  const results = new Map<
    string,
    {
      entry: LootEntry;
      totalDrops: number;
      rollHits: number;
      bundleHits: number;
      firstAppearance: number | null;
      timeline: {
        rollIndex: number;
        run: number;
        type: SimulationTimelineEventType;
        quantity?: number;
      }[];
    }
  >();
  const totalRollsByRun: number[] = [];

  const entriesTemplate = definition.entries.map((entry) => ({ ...entry }));

  const start = Date.now();
  let globalRollIndex = 0;

  for (let run = 0; run < runs; run += 1) {
    const pityMisses: Record<string, number> = {};
    const runHits = new Set<string>();
    const entries = entriesTemplate.map((entry) => ({
      ...entry,
      currentWeight: entry.weight,
      removed: false,
    }));

    const rolls = getRollCount(definition.rollStrategy, rng);
    totalRollsByRun.push(rolls);

    for (let i = 0; i < rolls; i += 1) {
      adjustProgressiveWeights(entries, definition.weightDistribution === 'PROGRESSIVE' ? definition.progressive : undefined);

      const weightedEntries = entries.map((entry) => ({
        ...entry,
        currentWeight: definition.weightDistribution === 'PITY'
          ? applyPityWeights(entry, pityLookup, pityMisses)
          : entry.currentWeight,
      }));

      const selected = pickEntry(weightedEntries, rng);
      if (!selected) break;

      const quantity = randomInt(rng, selected.minYield, selected.maxYield);
      const existing =
        results.get(selected.id) ?? {
          entry: { ...selected },
          totalDrops: 0,
          rollHits: 0,
          bundleHits: 0,
          firstAppearance: null as number | null,
          timeline: [] as {
            rollIndex: number;
            run: number;
            type: SimulationTimelineEventType;
            quantity?: number;
          }[],
        };
      existing.totalDrops += quantity;
      existing.rollHits += 1;
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

      // Reset pity counters for the selected entry, increment for the rest
      if (definition.weightDistribution === 'PITY') {
        pityMisses[selected.id] = 0;
        for (const entry of entries) {
          if (entry.id !== selected.id && !entry.removed) {
            pityMisses[entry.id] = (pityMisses[entry.id] ?? 0) + 1;
          }
        }
      }

      const replacement = resolveReplacement(selected, definition.replacementStrategy);
      if (replacement === 'WITHOUT_REPLACEMENT') {
        const target = entries.find((entry) => entry.id === selected.id);
        if (target) {
          target.removed = true;
        }
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
  }

  const totalRolls = totalRollsByRun.reduce((sum, count) => sum + count, 0) || 1;
  const resultEntries = Array.from(results.entries()).map(([entryId, payload]) => ({
    entryId,
    type: payload.entry.type,
    totalDrops: payload.totalDrops,
    minYield: payload.entry.minYield,
    maxYield: payload.entry.maxYield,
    itemId: payload.entry.itemId,
    firstAppearedAt: payload.firstAppearance,
    probability: payload.rollHits / totalRolls,
    perRunAverage: payload.totalDrops / runs,
    rollHits: payload.rollHits,
    bundleHits: payload.bundleHits,
    timeline: payload.timeline,
  }));

  const response: CompleteMessage = {
    type: 'complete',
    result: {
      runs,
      durationMs: Date.now() - start,
      totalRolls,
      entries: resultEntries,
    },
  };

  self.postMessage(response satisfies WorkerResponse);
};
