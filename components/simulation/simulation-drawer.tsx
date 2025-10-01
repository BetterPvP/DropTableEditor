'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  const [activeView, setActiveView] = useState<'overview' | 'inspector'>('overview');
  const [sortMode, setSortMode] = useState<'yield' | 'hits' | 'bundle' | 'name'>('yield');
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
    const rows = result.entries.map((entry) => {
      const baseProbability = probabilities[entry.entryId] ?? 0;
      const item = items.find((candidate) => candidate.id === entry.itemId);
      return {
        ...entry,
        baseProbability,
        name: item?.name ?? entry.itemId,
      };
    });
    const sorters: Record<typeof sortMode, (a: (typeof rows)[number], b: (typeof rows)[number]) => number> = {
      yield: (a, b) => b.totalYield - a.totalYield,
      hits: (a, b) => b.hits - a.hits,
      bundle: (a, b) => b.bundleHits - a.bundleHits,
      name: (a, b) => a.name.localeCompare(b.name),
    };
    const sorter = sorters[sortMode] ?? sorters.yield;
    return rows.sort(sorter);
  }, [items, probabilities, result, sortMode]);

  useEffect(() => {
    if (activeView === 'inspector' && selectedEntry === null) {
      setActiveView('overview');
    }
  }, [activeView, selectedEntry]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm">
      <div className="glass-panel flex h-full w-full max-w-6xl flex-col border-l border-white/10 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Simulation</h2>
            <p className="text-sm text-foreground/60">Run Monte Carlo trials in a dedicated worker thread.</p>
          </div>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-[340px_1fr]">
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
                    <span>Rolls processed</span>
                    <span className="font-semibold">{result.totalRolls.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Unique entries</span>
                    <span className="font-semibold">{result.entries.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Total yielded</span>
                    <span className="font-semibold">{result.entries.reduce((sum, e) => sum + e.totalYield, 0).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Avg yield/run</span>
                    <span className="font-semibold">
                      {(result.entries.reduce((sum, e) => sum + e.totalYield, 0) / result.runs).toFixed(2)}
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
        <div className="mt-6 flex-1 rounded-2xl border border-white/10 bg-black/30">
          <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
            <div className="flex items-center gap-2 text-sm">
              <Button
                type="button"
                size="sm"
                variant={activeView === 'overview' ? 'default' : 'ghost'}
                onClick={() => setActiveView('overview')}
              >
                Overview
              </Button>
              <Button
                type="button"
                size="sm"
                variant={activeView === 'inspector' ? 'default' : 'ghost'}
                disabled={!selectedEntry}
                onClick={() => selectedEntry && setActiveView('inspector')}
              >
                Entry inspector
              </Button>
            </div>
            {activeView === 'overview' && (
              <div className="flex items-center gap-2 text-xs text-foreground/60">
                <span>Sort by</span>
                <div className="w-40">
                  <Select value={sortMode} onValueChange={(value) => setSortMode(value as typeof sortMode)}>
                    <SelectTrigger>
                      <SelectValue>
                        {sortMode === 'yield'
                          ? 'Most yielded'
                          : sortMode === 'hits'
                          ? 'Most rolled'
                          : sortMode === 'bundle'
                          ? 'Most bundles'
                          : 'Alphabetical'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yield">Most yielded</SelectItem>
                      <SelectItem value="hits">Most rolled</SelectItem>
                      <SelectItem value="bundle">Most bundles</SelectItem>
                      <SelectItem value="name">Alphabetical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
          {activeView === 'overview' ? (
            <div className="flex h-full flex-col p-4">
              <p className="text-sm text-foreground/50">
                Compare base probabilities against observed outcomes. Totals include yielded amounts per entry.
              </p>
              <ScrollArea className="mt-4 flex-1 rounded-xl border border-white/10 bg-black/40">
                <table className="w-full text-sm text-foreground/80">
                  <thead className="sticky top-0 bg-black/80 text-xs uppercase tracking-wide text-foreground/60">
                    <tr>
                      <th className="px-3 py-2 text-left">Loot</th>
                      <th className="px-3 py-2 text-right">Type</th>
                      <th className="px-3 py-2 text-right">Yielded</th>
                      <th className="px-3 py-2 text-right">Roll hits</th>
                      <th className="px-3 py-2 text-right">Bundle hits</th>
                      <th className="px-3 py-2 text-right">Avg/run</th>
                      <th className="px-3 py-2 text-right">Sim %</th>
                      <th className="px-3 py-2 text-right">Base %</th>
                      <th className="px-3 py-2 text-right">First</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.length === 0 && (
                      <tr>
                        <td className="px-4 py-6 text-center text-foreground/50" colSpan={9}>
                          Run the simulation to populate this table.
                        </td>
                      </tr>
                    )}
                    {tableRows.map((entry) => (
                      <tr
                        key={entry.entryId}
                        className={`border-b border-white/5 cursor-pointer transition-colors hover:bg-primary/10 ${selectedEntry === entry.entryId ? 'bg-primary/20' : ''}`}
                        onClick={() => {
                          const newSelection = selectedEntry === entry.entryId ? null : entry.entryId;
                          setSelectedEntry(newSelection);
                          setActiveView(newSelection ? 'inspector' : 'overview');
                        }}
                      >
                        <td className="px-3 py-2">{entry.name}</td>
                        <td className="px-3 py-2 text-right text-xs">{entry.type === 'dropped_item' ? 'Drop' : 'Give'}</td>
                        <td className="px-3 py-2 text-right">{entry.totalYield.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right">{entry.hits.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right">{entry.bundleHits.toLocaleString()}</td>
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
            </div>
          ) : (
            <div className="flex h-full flex-col gap-4 p-4">
              {selectedEntry ? (
                (() => {
                  const entry = tableRows.find((candidate) => candidate.entryId === selectedEntry);
                  if (!entry) return null;
                  const totalBase = tableRows.reduce((sum, row) => sum + row.baseProbability, 0) || 1;
                  const weightShare = entry.baseProbability / totalBase;
                  const expectedHits = result?.totalRolls ? entry.baseProbability * result.totalRolls : 0;
                  const heatRatio = expectedHits === 0 ? 0 : entry.hits / expectedHits;
                  const heatWidth = Math.min(heatRatio, 2) / 2 * 100;
                  const heatState = heatRatio > 1.1 ? 'hot' : heatRatio < 0.9 ? 'cold' : 'warm';
                  const heatClass =
                    heatState === 'hot'
                      ? 'bg-rose-500/80'
                      : heatState === 'cold'
                      ? 'bg-sky-500/80'
                      : 'bg-emerald-500/80';
                  const timeline = entry.timeline;
                  const totalRolls = result?.totalRolls ?? 0;
                  return (
                    <>
                      <div className="flex items-start justify-between gap-6">
                        <div>
                          <h3 className="text-lg font-semibold text-white">{entry.name}</h3>
                          <p className="text-sm text-foreground/60">Detailed roll history and probability diagnostics.</p>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-right text-xs text-foreground/60">
                          <div>Type: {entry.type === 'dropped_item' ? 'Dropped item' : 'Given item'}</div>
                          <div>Appeared: {entry.firstAppearedAt ? `roll #${entry.firstAppearedAt}` : 'never'}</div>
                          <div>Bundles: {entry.bundleHits.toLocaleString()}</div>
                        </div>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-xl border border-white/5 bg-black/50 p-4">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-foreground/60">Total yielded</span>
                            <span className="font-semibold text-foreground">{entry.totalYield.toLocaleString()}</span>
                          </div>
                          <div className="mt-2 flex items-center justify-between text-xs text-foreground/60">
                            <span>Roll hits</span>
                            <span className="text-foreground/80">{entry.hits.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-foreground/60">
                            <span>Per run</span>
                            <span className="text-foreground/80">{entry.perRunAverage.toFixed(3)}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-foreground/60">
                            <span>Variance</span>
                            <span className="text-foreground/80">{((entry.probability - entry.baseProbability) * 100).toFixed(3)}%</span>
                          </div>
                        </div>
                        <div className="rounded-xl border border-white/5 bg-black/50 p-4">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-foreground/60">Weight share</span>
                            <span className="font-semibold text-foreground">{(weightShare * 100).toFixed(2)}%</span>
                          </div>
                          <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-white/10">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${Math.min(1, weightShare) * 100}%` }}
                            />
                          </div>
                          <p className="mt-2 text-xs text-foreground/50">
                            Base probability {(entry.baseProbability * 100).toFixed(2)}% relative to table weights.
                          </p>
                        </div>
                      </div>
                      <div className="rounded-xl border border-white/5 bg-black/50 p-4">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-foreground/60">Heat vs expected frequency</span>
                          <span className="font-semibold text-foreground">
                            {heatRatio === 0 ? 'No data' : `${heatRatio.toFixed(2)}x`}
                          </span>
                        </div>
                        <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-white/10">
                          <div className={`h-full ${heatClass}`} style={{ width: `${heatWidth}%` }} />
                        </div>
                        <p className="mt-2 text-xs text-foreground/50">
                          Expected {(expectedHits || 0).toFixed(1)} hits based on base probability; observed {entry.hits.toLocaleString()}.
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/5 bg-black/50 p-4">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-foreground/60">Appearance timeline</span>
                          <span className="text-xs text-foreground/50">
                            Showing up to {timeline.length.toLocaleString()} recorded events
                          </span>
                        </div>
                        <div className="relative mt-4 h-16 w-full rounded-lg bg-white/5">
                          {totalRolls > 0 &&
                            timeline.map((event, index) => {
                              const left = Math.min(100, Math.max(0, ((event.globalRoll - 1) / totalRolls) * 100));
                              return (
                                <div
                                  key={`${event.globalRoll}-${index}`}
                                  className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/80 shadow"
                                  style={{ left: `${left}%` }}
                                  title={`Run #${event.run} • Roll #${event.globalRoll} • Yield ${event.quantity}`}
                                />
                              );
                            })}
                        </div>
                        <p className="mt-2 text-xs text-foreground/50">
                          Markers indicate when this entry yielded loot across the simulation timeline.
                        </p>
                      </div>
                    </>
                  );
                })()
              ) : (
                <div className="flex h-full flex-col items-center justify-center text-center text-sm text-foreground/50">
                  <p>Select a row from the overview to inspect its timeline and probability diagnostics.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
