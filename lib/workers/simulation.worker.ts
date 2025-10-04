/// <reference lib="webworker" />

import {
  LootEntry,
  LootTableDefinition,
  PityRule,
  ProgressiveConfig,
  SimulationResult,
  SimulationTimelineEventType,
  SimulationResultEntrySource,
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

function getRollCount(
  strategy: LootTableDefinition['rollStrategy'],
  runIndex: number,
  rng: () => number
) {
  switch (strategy.type) {
    case 'CONSTANT':
      return Math.max(0, Math.floor(strategy.rolls));
    case 'PROGRESSIVE': {
      const progressCount = runIndex; // simulates LootProgress.history.size()
      const value = strategy.baseRolls + progressCount * strategy.rollIncrement;
      return Math.min(Math.floor(value), Math.floor(strategy.maxRolls));
    }
    case 'RANDOM':
      return randomInt(rng, strategy.min, strategy.max);
    default:
      return 0;
  }
}


function applyPityWeights(
  entry: LootEntry & { currentWeight?: number },
  pityRules: Record<string, PityRule>,
  failedRuns: Record<string, number>,
  awardedThisRun: Set<string>, // suppress pity inside current bundle/run
): number {
  const baseWeight = entry.currentWeight ?? entry.weight;

  // if already awarded in this run (including guaranteed), no pity boost
  if (awardedThisRun.has(entry.id)) return baseWeight;

  const rule = pityRules[entry.id];
  if (!rule) return baseWeight;

  const failedCount = failedRuns[entry.id] ?? 0;
  if (failedCount === 0) return baseWeight;

  const increments = Math.floor(failedCount / rule.maxAttempts);
  return baseWeight + increments * rule.weightIncrement;
}

function adjustProgressiveWeights(
  entries: (LootEntry & { currentWeight: number; removed: boolean })[],
  config?: ProgressiveConfig,
) {
  if (!config) return;
  const active = entries.filter(e => !e.removed && e.currentWeight > 0);
  if (active.length === 0) return;

  const avg = active.reduce((s, e) => s + e.currentWeight, 0) / active.length;
  const factor = config.shiftFactor ?? 0.5;
  const maxShift = config.maxShift ?? 5;
  const scaleVar = (config as any).enableVarianceScaling ?? config.varianceScaling ?? true;

  for (const e of active) {
    const delta = avg - e.currentWeight;
    let shift = delta * factor;
    if (scaleVar) {
      const spread = Math.abs(delta);
      const scale = avg === 0 ? 1 : spread / avg;
      shift *= scale;
    }
    if (maxShift > 0) {
      if (shift >  maxShift) shift =  maxShift;
      if (shift < -maxShift) shift = -maxShift;
    }
    e.currentWeight = Math.max(0, e.currentWeight + shift);
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

  const entriesTemplate = definition.entries.map((entry) => ({ ...entry }));

  const start = Date.now();
  let globalRollIndex = 0;
  const failedRuns: Record<string, number> = {};

  for (let run = 0; run < runs; run += 1) {
    const runHits = new Set<string>();
    const entries = entriesTemplate.map((entry) => ({
      ...entry,
      currentWeight: entry.weight,
      removed: false,
    }));

    // guaranteed entries count as awarded for pity suppression in this run
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

      runHits.add(guaranteedEntry.id); // suppress pity for this entry in this run
    }

    const rolls = getRollCount(definition.rollStrategy, run, rng);
    totalRollsByRun.push(rolls);

    for (let i = 0; i < rolls; i += 1) {
      adjustProgressiveWeights(
        entries,
        definition.weightDistribution === 'PROGRESSIVE' ? definition.progressive : undefined,
      );

      const weightedEntries = entries.map((entry) => ({
        ...entry,
        currentWeight:
          definition.weightDistribution === 'PITY'
            ? applyPityWeights(entry, pityLookup, failedRuns, runHits)
            : entry.currentWeight,
      }));

      const selected = pickEntry(weightedEntries, rng);
      if (!selected) break;

      const quantity = randomInt(rng, selected.minYield, selected.maxYield);
      const existing =
        results.get(selected.id) ?? {
          entry: { ...selected },
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
        runHits.add(selected.id); // mark awarded so later rolls get no pity for this entry
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

    // Update pity counters at the end of each run
    if (definition.weightDistribution === 'PITY') {
      for (const entry of entries) {
        if (runHits.has(entry.id)) {
          // Reset counter for entries that appeared in this run
          failedRuns[entry.id] = 0;
        } else {
          // Increment counter for entries that didn't appear
          failedRuns[entry.id] = (failedRuns[entry.id] ?? 0) + 1;
        }
      }
    }
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
