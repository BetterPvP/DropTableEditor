'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, Loader2 } from 'lucide-react';
import {
  Area,
  AreaChart,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LootTableDefinition, SimulationResult } from '@/lib/loot-tables/types';
import type { Database } from '@/supabase/types';
import { cn } from '@/lib/utils';

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

type SortOption = 'yield' | 'rollHits' | 'bundleHits' | 'name';
type SimulatorTab = 'overview' | 'entries';

export function SimulationDrawer({ open, onClose, definition, probabilities, items }: SimulationDrawerProps) {
  const [runs, setRuns] = useState(1000);
  const [seed, setSeed] = useState('');
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null);
  const [sortOption, setSortOption] = useState<SortOption>('yield');
  const [activeTab, setActiveTab] = useState<SimulatorTab>('entries');
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
    setActiveTab('overview');

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

    return rows.sort((a, b) => {
      switch (sortOption) {
        case 'rollHits':
          return b.rollHits - a.rollHits || b.totalDrops - a.totalDrops;
        case 'bundleHits':
          return b.bundleHits - a.bundleHits || b.totalDrops - a.totalDrops;
        case 'name':
          return a.name.localeCompare(b.name);
        case 'yield':
        default:
          return b.totalDrops - a.totalDrops || b.rollHits - a.rollHits;
      }
    });
  }, [items, probabilities, result, sortOption]);

  const totalRolls = useMemo(() => {
    if (!result) return 0;
    return result.entries.reduce((sum, entry) => sum + entry.rollHits, 0);
  }, [result]);

  const aggregatedRunTimeline = useMemo(() => {
    if (!result) return [] as { run: number; hits: number; totalYield: number }[];
    const map = new Map<number, { run: number; hits: number; totalYield: number }>();
    for (const entry of result.entries) {
      for (const event of entry.timeline) {
        const current = map.get(event.run) ?? { run: event.run, hits: 0, totalYield: 0 };
        current.hits += 1;
        current.totalYield += event.quantity;
        map.set(event.run, current);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.run - b.run);
  }, [result]);

  const probabilityChartData = useMemo(() => {
    return definition.entries
      .map((entry) => {
        const probabilityValue = probabilities[entry.id] ?? 0;
        const item = items.find((candidate) => candidate.id === entry.itemId);
        return {
          id: entry.id,
          name: item?.name ?? entry.itemId,
          probability: probabilityValue,
        };
      })
      .sort((a, b) => b.probability - a.probability);
  }, [definition.entries, items, probabilities]);

  const yieldDistribution = useMemo(() => {
    if (tableRows.length === 0) return [] as { id: string; name: string; value: number }[];
    const top = tableRows.slice(0, 6).map((row) => ({
      id: row.entryId,
      name: row.name,
      value: row.totalDrops,
    }));
    const remainder = tableRows.slice(6).reduce((sum, row) => sum + row.totalDrops, 0);
    if (remainder > 0) {
      top.push({ id: 'other', name: 'Other', value: remainder });
    }
    return top;
  }, [tableRows]);

  const tabs: { id: SimulatorTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'entries', label: 'Per-entry' },
  ];

  const chartPalette = ['#6366F1', '#22D3EE', '#F97316', '#F472B6', '#84CC16', '#FACC15', '#34D399', '#F87171'];

  const totalYieldedShare = useMemo(() => {
    return yieldDistribution.reduce((sum, slice) => sum + slice.value, 0);
  }, [yieldDistribution]);

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
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
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
                    <span>Total yielded</span>
                    <span className="font-semibold">{result.entries.reduce((sum, e) => sum + e.totalDrops, 0).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Total rolls observed</span>
                    <span className="font-semibold">{totalRolls.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Avg yield/run</span>
                    <span className="font-semibold">
                      {(result.entries.reduce((sum, e) => sum + e.totalDrops, 0) / result.runs).toFixed(2)}
                    </span>
                  </div>
                  {result.entries.length > 0 && (
                    <>
                      <div className="flex items-center justify-between">
                        <span>Most yielded entry</span>
                        <span className="font-semibold truncate max-w-[220px]" title={tableRows[0]?.name}>
                          {tableRows[0]?.name}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Least yielded entry</span>
                        <span
                          className="font-semibold truncate max-w-[220px]"
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
        <div className="mt-6 flex flex-1 flex-col overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'rounded-full px-4 py-1 text-xs font-semibold uppercase tracking-wide transition-colors',
                    activeTab === tab.id
                      ? 'bg-primary/90 text-white shadow-lg shadow-primary/30'
                      : 'text-foreground/60 hover:text-foreground',
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {activeTab === 'entries' && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-foreground/60">Sort by</span>
                <Select value={sortOption} onValueChange={(value) => setSortOption(value as SortOption)}>
                  <SelectTrigger className="w-[170px] border-white/10 bg-black/40 text-foreground">
                    <SelectValue placeholder="Most yielded" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yield">Most yielded</SelectItem>
                    <SelectItem value="rollHits">Most roll hits</SelectItem>
                    <SelectItem value="bundleHits">Most bundles</SelectItem>
                    <SelectItem value="name">Name</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="mt-4 flex-1 overflow-hidden">
            {activeTab === 'overview' ? (
              <div className="grid h-full gap-4 md:grid-cols-2">
                <Card className="flex flex-col">
                  <CardHeader>
                    <CardTitle>Yield distribution</CardTitle>
                    <CardDescription>Share of total yield across entries.</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col gap-4">
                    {result && yieldDistribution.length > 0 ? (
                      <>
                        <div className="h-56">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <RechartsTooltip
                                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                                formatter={(value: number, _name, payload) => {
                                  const total = totalYieldedShare || 1;
                                  return [`${((value as number) / total * 100).toFixed(2)}%`, payload?.payload?.name];
                                }}
                              />
                              <Pie
                                data={yieldDistribution}
                                dataKey="value"
                                nameKey="name"
                                innerRadius={50}
                                outerRadius={90}
                                paddingAngle={3}
                              >
                                {yieldDistribution.map((slice, index) => (
                                  <Cell
                                    key={slice.id}
                                    fill={slice.id === selectedEntry ? '#a855f7' : chartPalette[index % chartPalette.length]}
                                    opacity={slice.id === 'other' ? 0.35 : 1}
                                  />
                                ))}
                              </Pie>
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <ul className="space-y-1 text-xs text-foreground/70">
                          {yieldDistribution.map((slice) => (
                            <li key={slice.id} className="flex items-center justify-between">
                              <span className="truncate" title={slice.name}>
                                {slice.name}
                              </span>
                              <span className="font-semibold">
                                {(((slice.value || 0) / (totalYieldedShare || 1)) * 100).toFixed(2)}%
                              </span>
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : (
                      <p className="text-sm text-foreground/60">Run a simulation to visualise yield share.</p>
                    )}
                  </CardContent>
                </Card>
                <Card className="flex flex-col">
                  <CardHeader>
                    <CardTitle>Run timeline</CardTitle>
                    <CardDescription>Aggregated hits and yield by run.</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col">
                    {result && aggregatedRunTimeline.length > 0 ? (
                      <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={aggregatedRunTimeline} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
                            <XAxis dataKey="run" tickLine={false} axisLine={false} stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 12 }} />
                            <YAxis hide />
                            <RechartsTooltip
                              labelFormatter={(label) => `Run ${label}`}
                              formatter={(value: number, name) => [value, name === 'totalYield' ? 'Yielded' : 'Roll hits']}
                              contentStyle={{ backgroundColor: 'rgba(17, 24, 39, 0.9)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' }}
                            />
                            <Area type="monotone" dataKey="totalYield" stroke="#6366F1" fill="rgba(99, 102, 241, 0.35)" name="Yielded" />
                            <Line type="monotone" dataKey="hits" stroke="#22D3EE" strokeWidth={2} dot={false} name="Roll hits" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <p className="text-sm text-foreground/60">Timeline will appear after running the simulation.</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card className="flex h-full flex-col">
                <CardHeader>
                  <CardTitle>Per-entry results</CardTitle>
                  <CardDescription>
                    Compare base probabilities to the observed distribution. Totals represent yielded amounts, with roll and bundle hit counts alongside.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex h-full flex-col">
                  <ScrollArea className="flex-1 min-h-[360px] max-h-[600px] rounded-xl border border-white/10 bg-black/40">
                    <table className="w-full text-sm text-foreground/80">
                      <thead className="sticky top-0 bg-black/80 text-xs uppercase tracking-wide text-foreground/60">
                        <tr>
                          <th className="px-3 py-2 text-left">Loot</th>
                          <th className="px-3 py-2 text-right">Type</th>
                          <th className="px-3 py-2 text-right">Yielded</th>
                          <th className="px-3 py-2 text-right">Roll hits</th>
                          <th className="px-3 py-2 text-right">Bundles</th>
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
                            className={cn(
                              'border-b border-white/5 cursor-pointer transition-colors hover:bg-primary/10',
                              selectedEntry === entry.entryId && 'bg-primary/20',
                            )}
                            onClick={() => setSelectedEntry(selectedEntry === entry.entryId ? null : entry.entryId)}
                          >
                            <td className="px-3 py-2">{entry.name}</td>
                            <td className="px-3 py-2 text-right text-xs">{entry.type === 'dropped_item' ? 'Drop' : 'Give'}</td>
                            <td className="px-3 py-2 text-right">{entry.totalDrops.toLocaleString()}</td>
                            <td className="px-3 py-2 text-right">{entry.rollHits.toLocaleString()}</td>
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
                  {selectedEntry && (() => {
                    const entry = tableRows.find((e) => e.entryId === selectedEntry);
                    if (!entry) return null;

                    const expectedHits = totalRolls * entry.baseProbability;
                    const heatRatio = expectedHits > 0 ? entry.rollHits / expectedHits : null;
                    const heatLabel = heatRatio === null
                      ? 'No expectation'
                      : heatRatio > 1.25
                        ? 'Running hot'
                        : heatRatio < 0.75
                          ? 'Running cold'
                          : 'Within expected';
                    const heatTone = heatRatio === null
                      ? 'border-white/20 text-foreground/70'
                      : heatRatio > 1.25
                        ? 'border-rose-400/40 bg-rose-500/20 text-rose-100'
                        : heatRatio < 0.75
                          ? 'border-sky-400/40 bg-sky-500/20 text-sky-100'
                          : 'border-emerald-400/40 bg-emerald-500/20 text-emerald-100';
                    const timelineMarkers = entry.timeline.slice(0, 200);
                    const timelineSeries = (() => {
                      const map = new Map<number, { run: number; hits: number; yield: number }>();
                      for (const event of entry.timeline) {
                        const existing = map.get(event.run) ?? { run: event.run, hits: 0, yield: 0 };
                        existing.hits += 1;
                        existing.yield += event.quantity;
                        map.set(event.run, existing);
                      }
                      return Array.from(map.values()).sort((a, b) => a.run - b.run);
                    })();
                    const probabilitySlices = (() => {
                      const ranked = probabilityChartData;
                      const selection = ranked.slice(0, 7);
                      const exists = selection.find((slice) => slice.id === entry.entryId);
                      if (!exists) {
                        const target = ranked.find((slice) => slice.id === entry.entryId);
                        if (target) {
                          selection.push(target);
                        }
                      }
                      const includedIds = new Set(selection.map((slice) => slice.id));
                      const remainder = ranked
                        .filter((slice) => !includedIds.has(slice.id))
                        .reduce((sum, slice) => sum + slice.probability, 0);
                      if (remainder > 0) {
                        selection.push({ id: 'other', name: 'Other', probability: remainder });
                      }
                      return selection;
                    })();
                    const dropRate = entry.rollHits > 0 ? Math.round(Math.max(totalRolls, 1) / entry.rollHits) : null;

                    return (
                      <div className="mt-4 space-y-4 rounded-xl border border-primary/40 bg-primary/5 p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <h3 className="text-sm font-semibold text-white">Detailed information: {entry.name}</h3>
                          <span className={cn('rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide', heatTone)}>
                            {heatLabel}
                            {heatRatio !== null && (
                              <span className="ml-2 font-normal normal-case text-foreground/70">
                                {heatRatio.toFixed(2)}x expected
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="grid gap-4 text-sm md:grid-cols-2 xl:grid-cols-3">
                          <div className="flex items-center justify-between">
                            <span className="text-foreground/60">Entry type</span>
                            <span className="text-foreground/90">{entry.type === 'dropped_item' ? 'Dropped item' : 'Given item'}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-foreground/60">Yielded total</span>
                            <span className="font-semibold text-foreground/90">{entry.totalDrops.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-foreground/60">Roll hits</span>
                            <span className="font-semibold text-foreground/90">{entry.rollHits.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-foreground/60">Bundles hit</span>
                            <span className="font-semibold text-foreground/90">{entry.bundleHits.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-foreground/60">Per-run yield</span>
                            <span className="font-semibold text-foreground/90">{entry.perRunAverage.toFixed(3)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-foreground/60">Per-hit yield</span>
                            <span className="font-semibold text-foreground/90">
                              {entry.rollHits > 0 ? (entry.totalDrops / entry.rollHits).toFixed(3) : '0.000'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-foreground/60">Simulated probability</span>
                            <span className="font-semibold text-foreground/90">{(entry.probability * 100).toFixed(3)}%</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-foreground/60">Base probability</span>
                            <span className="font-semibold text-foreground/90">{(entry.baseProbability * 100).toFixed(3)}%</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-foreground/60">Variance</span>
                            <span className="font-semibold text-foreground/90">
                              {((entry.probability - entry.baseProbability) * 100).toFixed(3)}%
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-foreground/60">Expected hits</span>
                            <span className="font-semibold text-foreground/90">{expectedHits.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-foreground/60">First appearance</span>
                            <span className="text-foreground/90">
                              {entry.firstAppearedAt ? `Roll #${entry.firstAppearedAt}` : 'Never appeared'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-foreground/60">Roll rate</span>
                            <span className="text-foreground/90">
                              {dropRate ? `1 in ${dropRate} rolls` : 'No hits'}
                            </span>
                          </div>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="rounded-lg border border-white/10 bg-black/30 p-4">
                            <p className="text-xs uppercase tracking-wide text-foreground/50">Timeline</p>
                            <div className="mt-3 space-y-3">
                              <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/10">
                                {timelineMarkers.map((event, index) => (
                                  <span
                                    key={`${event.globalRoll}-${index}`}
                                    className="absolute top-0 h-full w-[2px] bg-primary"
                                    style={{ left: `${(event.globalRoll / Math.max(totalRolls, 1)) * 100}%` }}
                                  />
                                ))}
                              </div>
                              {entry.timeline.length > timelineMarkers.length && (
                                <p className="text-xs text-foreground/60">
                                  Showing first {timelineMarkers.length} of {entry.timeline.length} events.
                                </p>
                              )}
                              <div className="h-32">
                                {timelineSeries.length > 0 ? (
                                  <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={timelineSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                      <XAxis dataKey="run" tickLine={false} axisLine={false} stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 11 }} />
                                      <YAxis hide />
                                      <RechartsTooltip
                                        labelFormatter={(label) => `Run ${label}`}
                                        formatter={(value: number, name) => [value, name === 'yield' ? 'Yielded' : 'Roll hits']}
                                        contentStyle={{ backgroundColor: 'rgba(17, 24, 39, 0.9)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' }}
                                      />
                                      <Area type="monotone" dataKey="yield" stroke="#a855f7" fill="rgba(168, 85, 247, 0.35)" name="Yield" />
                                      <Line type="monotone" dataKey="hits" stroke="#22D3EE" strokeWidth={2} dot={false} name="Hits" />
                                    </AreaChart>
                                  </ResponsiveContainer>
                                ) : (
                                  <p className="text-xs text-foreground/60">This entry never appeared during the simulation.</p>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="rounded-lg border border-white/10 bg-black/30 p-4">
                            <p className="text-xs uppercase tracking-wide text-foreground/50">Probability weight</p>
                            <div className="mt-3 h-40">
                              <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <RechartsTooltip
                                    formatter={(value: number, _name, payload) => [`${((value as number) * 100).toFixed(2)}%`, payload?.payload?.name]}
                                    contentStyle={{ backgroundColor: 'rgba(17, 24, 39, 0.9)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' }}
                                  />
                                  <Pie data={probabilitySlices} dataKey="probability" nameKey="name" innerRadius={40} outerRadius={80} paddingAngle={3}>
                                    {probabilitySlices.map((slice, index) => (
                                      <Cell
                                        key={slice.id}
                                        fill={slice.id === entry.entryId ? '#6366F1' : chartPalette[index % chartPalette.length]}
                                        opacity={slice.id === 'other' ? 0.3 : 1}
                                      />
                                    ))}
                                  </Pie>
                                </PieChart>
                              </ResponsiveContainer>
                            </div>
                            <ul className="mt-3 space-y-1 text-xs text-foreground/70">
                              {probabilitySlices.map((slice) => (
                                <li key={slice.id} className="flex items-center justify-between">
                                  <span className="truncate" title={slice.name}>
                                    {slice.name}
                                  </span>
                                  <span className="font-semibold">
                                    {(slice.probability * 100).toFixed(2)}%
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
