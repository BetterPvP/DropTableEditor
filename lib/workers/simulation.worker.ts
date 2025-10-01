/// <reference lib="webworker" />

import { LootTableDefinition, SimulationResult } from '../loot-tables/types';
import { simulateLootTable } from '../loot-tables/simulator';

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

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;
  if (message.type !== 'start') return;

  const { definition, runs, seed } = message;

  const result = simulateLootTable({
    definition,
    runs,
    seed,
    onProgress: (completed, total) => {
      self.postMessage({ type: 'progress', completed, total } satisfies ProgressMessage);
    },
  });

  self.postMessage({ type: 'complete', result } satisfies CompleteMessage);
};
