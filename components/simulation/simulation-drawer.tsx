'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LootTableDefinition, SimulationResult } from '@/lib/loot-tables/types';
import type { Database } from '@/supabase/types';

interface SimulationDrawerProps {
  open: boolean;
  onClose: () => void;
  definition: LootTableDefinition;
  probabilities: Record<string, number>;
  items: Database['public']['Tables']['items']['Row'][];
}

type SimulationWorkerMessage =
  | { type: 'progress'; completed: number; total: number }
  | { type: 'complete'; result: SimulationResult };

type SimulationWorkerRequest = {
  type: 'start';
  definition: LootTableDefinition;
  runs: number;
  seed?: number;
};

export function SimulationDrawer({ open, onClose, definition, probabilities, items }: SimulationDrawerProps) {
  const [runs, setRuns] = useState(1000);
  const [seed, setSeed] = useState('');
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  const handleRun = () => {
    if (runs <= 0) {
      setError('Iteration count must be positive.');
      return;
    }
    setRunning(true);
    setError(null);
    setProgress(0);
    setResult(null);

    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }

    const worker = new Worker(new URL('../../lib/workers/simulation.worker.ts', import.meta.url));
    workerRef.current = worker;
    worker.onmessage = (event: MessageEvent<SimulationWorkerMessage>) => {
      if (event.data.type === 'progress') {
        const { completed, total } = event.data;
        setProgress(total === 0 ? 0 : completed / total);
      } else if (event.data.type === 'complete') {
        setResult(event.data.result);
        setProgress(1);
        setRunning(false);
        workerRef.current?.terminate();
        workerRef.current = null;
      }
    };
    worker.onerror = (event) => {
      console.error('Simulation worker error', event);
      setError('Simulation failed. Check console for details.');
      setRunning(false);
      workerRef.current?.terminate();
      workerRef.current = null;
    };

    const payload: SimulationWorkerRequest = {
      type: 'start',
      definition,
      runs,
      seed: seed ? Number(seed) : undefined,
    };

    worker.postMessage(payload);
  };

  const tableRows = useMemo(() => {
    if (!result) return [];
    return result.entries
      .map((entry) => {
        const baseProbability = probabilities[entry.entryId] ?? 0;
        const item = items.find((candidate) => candidate.id === entry.itemId);
        return {
          ...entry,
          baseProbability,
          name: item?.name ?? entry.itemId,
        };
      })
      .sort((a, b) => b.totalDrops - a.totalDrops);
  }, [items, probabilities, result]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm">
      <div className="glass-panel flex h-full w-full max-w-4xl flex-col border-l border-white/10 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Simulation</h2>
            <p className="text-sm text-foreground/60">Run Monte Carlo trials in a dedicated worker thread.</p>
          </div>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Parameters</CardTitle>
              <CardDescription>Choose the number of runs and deterministic seed.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="runs">Runs</Label>
                <Input
                  id="runs"
                  type="number"
                  min={1}
                  value={runs}
                  onChange={(event) => setRuns(Number(event.target.value))}
                />
                <p className="text-xs text-foreground/50">More runs improve accuracy at the cost of longer execution time.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="seed">Seed</Label>
                <Input
                  id="seed"
                  placeholder="Optional seed"
                  value={seed}
                  onChange={(event) => setSeed(event.target.value)}
                />
                <p className="text-xs text-foreground/50">Using the same seed reproduces results for regression testing.</p>
              </div>
              <Button type="button" className="justify-between" onClick={handleRun} disabled={running}>
                {running ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Running…
                  </>
                ) : (
                  <>
                    Execute
                    <BarChart3 className="h-4 w-4" />
                  </>
                )}
              </Button>
              {error && <p className="text-xs text-destructive">{error}</p>}
              {running && (
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${Math.min(1, progress) * 100}%` }}
                  />
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
              <CardDescription>Overview of the latest simulation run.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-foreground/70">
              {result ? (
                <>
                  <div className="flex items-center justify-between">
                    <span>Runs completed</span>
                    <span className="font-semibold">{result.runs.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Duration</span>
                    <span className="font-semibold">{result.durationMs} ms</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Unique entries</span>
                    <span className="font-semibold">{result.entries.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Total drops</span>
                    <span className="font-semibold">{result.entries.reduce((sum, e) => sum + e.totalDrops, 0).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Avg drops/run</span>
                    <span className="font-semibold">
                      {(result.entries.reduce((sum, e) => sum + e.totalDrops, 0) / result.runs).toFixed(2)}
                    </span>
                  </div>
                  {result.entries.length > 0 && (
                    <>
                      <div className="flex items-center justify-between">
                        <span>Most common</span>
                        <span className="font-semibold truncate max-w-[150px]" title={tableRows[0]?.name}>
                          {tableRows[0]?.name}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Least common</span>
                        <span className="font-semibold truncate max-w-[150px]" title={tableRows[tableRows.length - 1]?.name}>
                          {tableRows[tableRows.length - 1]?.name}
                        </span>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <p>No simulation data yet. Configure parameters and execute to see results.</p>
              )}
            </CardContent>
          </Card>
        </div>
        <Card className="mt-6 flex-1">
          <CardHeader>
            <CardTitle>Per-entry results</CardTitle>
            <CardDescription>
              Compare base probabilities to the observed distribution. Totals include yielded amounts for item entries.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex h-full flex-col">
            <ScrollArea className="flex-1 min-h-[400px] max-h-[600px] rounded-xl border border-white/10 bg-black/40">
              <table className="w-full text-sm text-foreground/80">
                <thead className="sticky top-0 bg-black/80 text-xs uppercase tracking-wide text-foreground/60">
                  <tr>
                    <th className="px-3 py-2 text-left">Loot</th>
                    <th className="px-3 py-2 text-right">Type</th>
                    <th className="px-3 py-2 text-right">Total</th>
                    <th className="px-3 py-2 text-right">Avg</th>
                    <th className="px-3 py-2 text-right">Sim %</th>
                    <th className="px-3 py-2 text-right">Base %</th>
                    <th className="px-3 py-2 text-right">First</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.length === 0 && (
                    <tr>
                      <td className="px-4 py-6 text-center text-foreground/50" colSpan={7}>
                        Run the simulation to populate this table.
                      </td>
                    </tr>
                  )}
                  {tableRows.map((entry) => (
                    <tr
                      key={entry.entryId}
                      className={`border-b border-white/5 cursor-pointer transition-colors hover:bg-primary/10 ${selectedEntry === entry.entryId ? 'bg-primary/20' : ''}`}
                      onClick={() => setSelectedEntry(selectedEntry === entry.entryId ? null : entry.entryId)}
                    >
                      <td className="px-3 py-2">{entry.name}</td>
                      <td className="px-3 py-2 text-right text-xs">{entry.type === 'dropped_item' ? 'Drop' : 'Give'}</td>
                      <td className="px-3 py-2 text-right">{entry.totalDrops.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right">{entry.perRunAverage.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">{(entry.probability * 100).toFixed(2)}%</td>
                      <td className="px-3 py-2 text-right">{(entry.baseProbability * 100).toFixed(2)}%</td>
                      <td className="px-3 py-2 text-right text-xs">
                        {entry.firstAppearedAt ? `#${entry.firstAppearedAt}` : 'Never'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
            {selectedEntry && (() => {
              const entry = tableRows.find((e) => e.entryId === selectedEntry);
              if (!entry) return null;
              return (
                <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
                  <h3 className="text-sm font-semibold text-white mb-3">Detailed Information: {entry.name}</h3>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-foreground/60">Entry Type:</span>
                      <span className="text-foreground/90">{entry.type === 'dropped_item' ? 'Dropped Item' : 'Given Item'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-foreground/60">Total Yield:</span>
                      <span className="text-foreground/90 font-semibold">{entry.totalDrops.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-foreground/60">Per-Run Average:</span>
                      <span className="text-foreground/90 font-semibold">{entry.perRunAverage.toFixed(3)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-foreground/60">Simulated Probability:</span>
                      <span className="text-foreground/90 font-semibold">{(entry.probability * 100).toFixed(3)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-foreground/60">Base Probability:</span>
                      <span className="text-foreground/90 font-semibold">{(entry.baseProbability * 100).toFixed(3)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-foreground/60">Variance:</span>
                      <span className="text-foreground/90 font-semibold">
                        {((entry.probability - entry.baseProbability) * 100).toFixed(3)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-foreground/60">First Appearance:</span>
                      <span className="text-foreground/90">{entry.firstAppearedAt ? `Roll #${entry.firstAppearedAt}` : 'Never appeared'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-foreground/60">Drop Rate:</span>
                      <span className="text-foreground/90">
                        {entry.totalDrops > 0 ? `1 in ${Math.round(result!.runs / (entry.totalDrops / entry.perRunAverage))}` : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
