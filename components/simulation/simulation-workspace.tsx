'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, Loader2 } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip } from 'recharts';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LootTableDefinition, SimulationResult } from '@/lib/loot-tables/types';
import type { Database } from '@/supabase/types';

interface SimulationWorkspaceProps {
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

type SortOption = 'yielded' | 'rollHits' | 'bundleHits' | 'probability' | 'name';

const sortLabels: Record<SortOption, string> = {
  yielded: 'Most yielded',
  rollHits: 'Roll hits',
  bundleHits: 'Bundles hit',
  probability: 'Simulated %',
  name: 'Alphabetical',
};

const timelineColors: Record<'appeared' | 'rolled' | 'consumed', string> = {
  appeared: 'bg-sky-400',
  rolled: 'bg-emerald-400',
  consumed: 'bg-rose-500',
};

const probabilityColors = ['#22d3ee', '#1f2937'];

export function SimulationWorkspace({ definition, probabilities, items }: SimulationWorkspaceProps) {
  const [runs, setRuns] = useState(1000);
  const [seed, setSeed] = useState('');
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('yielded');
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
    setSelectedEntry(null);

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
        name: item?.name ?? entry.entryId,
      };
    });

    return rows.sort((a, b) => {
      switch (sortBy) {
        case 'yielded':
          return b.totalDrops - a.totalDrops;
        case 'rollHits':
          return b.rollHits - a.rollHits;
        case 'bundleHits':
          return b.bundleHits - a.bundleHits;
        case 'probability':
          return b.probability - a.probability;
        case 'name':
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });
  }, [items, probabilities, result, sortBy]);

  const selectedRow = useMemo(() => {
    if (!selectedEntry) return null;
    return tableRows.find((entry) => entry.entryId === selectedEntry) ?? null;
  }, [selectedEntry, tableRows]);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1fr,1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Simulation parameters</CardTitle>
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
                <div className="h-full bg-primary transition-all" style={{ width: `${Math.min(1, progress) * 100}%` }} />
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Run summary</CardTitle>
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
                  <span>Total rolls</span>
                  <span className="font-semibold">{result.totalRolls.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Total yielded</span>
                  <span className="font-semibold">
                    {result.entries.reduce((sum, entry) => sum + entry.totalDrops, 0).toLocaleString()}
                  </span>
                </div>
                {tableRows.length > 0 && (
                  <>
                    <div className="flex items-center justify-between">
                      <span>Top yield</span>
                      <span className="font-semibold truncate max-w-[150px]" title={tableRows[0]?.name}>
                        {tableRows[0]?.name}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Lowest yield</span>
                      <span
                        className="font-semibold truncate max-w-[150px]"
                        title={tableRows[tableRows.length - 1]?.name}
                      >
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
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle>Per-entry results</CardTitle>
              <CardDescription>
                Compare base probabilities to the observed distribution. Totals include yielded amounts for item entries.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-foreground/60">Sort by</span>
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(sortLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ScrollArea className="flex-1 min-h-[400px] max-h-[600px] rounded-xl border border-white/10 bg-black/40">
            <table className="w-full text-sm text-foreground/80">
              <thead className="sticky top-0 bg-black/80 text-xs uppercase tracking-wide text-foreground/60">
                <tr>
                  <th className="px-3 py-2 text-left">Loot</th>
                  <th className="px-3 py-2 text-right">Type</th>
                  <th className="px-3 py-2 text-right">Yielded</th>
                  <th className="px-3 py-2 text-right">Avg</th>
                  <th className="px-3 py-2 text-right">Roll hits</th>
                  <th className="px-3 py-2 text-right">Bundle hits</th>
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
                    onClick={() => setSelectedEntry(selectedEntry === entry.entryId ? null : entry.entryId)}
                  >
                    <td className="px-3 py-2">{entry.name}</td>
                    <td className="px-3 py-2 text-right text-xs">{entry.type === 'dropped_item' ? 'Drop' : 'Give'}</td>
                    <td className="px-3 py-2 text-right">{entry.totalDrops.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">{entry.perRunAverage.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right">{entry.rollHits.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">{entry.bundleHits.toLocaleString()}</td>
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
          {selectedRow && result && (
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Detailed Information: {selectedRow.name}</h3>
              <div className="grid gap-3 md:grid-cols-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-foreground/60">Entry Type:</span>
                  <span className="text-foreground/90">{selectedRow.type === 'dropped_item' ? 'Dropped Item' : 'Given Item'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground/60">Total Yield:</span>
                  <span className="text-foreground/90 font-semibold">{selectedRow.totalDrops.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground/60">Per-Run Average:</span>
                  <span className="text-foreground/90 font-semibold">{selectedRow.perRunAverage.toFixed(3)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground/60">Simulated Probability:</span>
                  <span className="text-foreground/90 font-semibold">{(selectedRow.probability * 100).toFixed(3)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground/60">Base Probability:</span>
                  <span className="text-foreground/90 font-semibold">{(selectedRow.baseProbability * 100).toFixed(3)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground/60">Variance:</span>
                  <span className="text-foreground/90 font-semibold">
                    {((selectedRow.probability - selectedRow.baseProbability) * 100).toFixed(3)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground/60">First Appearance:</span>
                  <span className="text-foreground/90">
                    {selectedRow.firstAppearedAt ? `Roll #${selectedRow.firstAppearedAt}` : 'Never appeared'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground/60">Roll Hits:</span>
                  <span className="text-foreground/90">{selectedRow.rollHits.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground/60">Bundles Hit:</span>
                  <span className="text-foreground/90">{selectedRow.bundleHits.toLocaleString()}</span>
                </div>
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-black/40 p-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground/60">Timeline</h4>
                  {selectedRow.timeline.length === 0 ? (
                    <p className="mt-3 text-sm text-foreground/60">This entry never appeared during the simulation.</p>
                  ) : (
                    <div className="mt-4">
                      <div className="relative h-24">
                        <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-white/20" />
                        {(() => {
                          const maxRoll = Math.max(...selectedRow.timeline.map((event) => event.rollIndex));
                          return selectedRow.timeline.map((event, index) => {
                            const percent = maxRoll <= 1 ? 0 : ((event.rollIndex - 1) / (maxRoll - 1)) * 100;
                            const tooltipLabel = [
                              event.type === 'rolled'
                                ? `Rolled x${event.quantity ?? 1}`
                                : event.type === 'appeared'
                                  ? 'Appeared'
                                  : 'Consumed',
                              `Roll #${event.rollIndex}`,
                              `Run #${event.run + 1}`,
                            ].join(' · ');
                            return (
                              <div
                                key={`${event.type}-${index}-${event.rollIndex}`}
                                className="absolute flex -translate-x-1/2 flex-col items-center text-[10px] text-foreground/70"
                                style={{ left: `${percent}%` }}
                              >
                                <span
                                  className={`h-4 w-4 rounded-full border border-white/40 ${timelineColors[event.type]}`}
                                  title={tooltipLabel}
                                />
                                <span className="mt-1">#{event.rollIndex}</span>
                              </div>
                            );
                          });
                        })()}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-3 text-[10px] uppercase tracking-wide text-foreground/50">
                        <span className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-sky-400" /> Appeared
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-emerald-400" /> Rolled
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-rose-500" /> Consumed
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="rounded-xl border border-white/10 bg-black/40 p-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground/60">Probability weight</h4>
                  <div className="mt-4 h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          dataKey="value"
                          data={[
                            { name: selectedRow.name, value: selectedRow.baseProbability },
                            { name: 'Others', value: Math.max(0, 1 - selectedRow.baseProbability) },
                          ]}
                          innerRadius={40}
                          outerRadius={80}
                          paddingAngle={2}
                        >
                          {[0, 1].map((index) => (
                            <Cell key={`slice-${index}`} fill={probabilityColors[index]} />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          formatter={(value: number, name: string) => [`${(value * 100).toFixed(2)}%`, name]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="mt-2 text-xs text-foreground/60">
                    Shows the base probability weight of this entry relative to the rest of the table.
                  </p>
                </div>
              </div>
              <div className="mt-4 rounded-xl border border-white/10 bg-black/40 p-4">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground/60">Heat indicator</h4>
                {(() => {
                  const expectedHits = selectedRow.baseProbability * result.totalRolls;
                  const ratio = expectedHits === 0 ? 0 : selectedRow.rollHits / expectedHits;
                  const clamped = Math.max(0, Math.min(2, ratio));
                  const widthPercent = `${Math.round(clamped * 50)}%`;
                  const color = ratio > 1.25 ? 'bg-rose-500' : ratio < 0.75 ? 'bg-sky-500' : 'bg-emerald-500';
                  return (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between text-xs text-foreground/70">
                        <span>Observed vs expected</span>
                        <span className="font-semibold text-white">{ratio ? ratio.toFixed(2) : '0.00'}x</span>
                      </div>
                      <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
                        <div className={`h-full ${color}`} style={{ width: widthPercent }} />
                      </div>
                      <div className="flex justify-between text-[11px] text-foreground/50">
                        <span>{`Expected hits: ${expectedHits.toFixed(2)}`}</span>
                        <span>{`Observed: ${selectedRow.rollHits.toLocaleString()}`}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
