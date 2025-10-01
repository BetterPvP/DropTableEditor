'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { BarChart3, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
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

const TIMELINE_BUCKET_COUNT = 48;

type TimelineBucket = {
  start: number;
  end: number;
  hits: number;
  yield: number;
  appeared: boolean;
};

type DecoratedEntry = SimulationResult['entries'][number] & {
  baseProbability: number;
  name: string;
  heatRatio: number | null;
};

function buildTimelineBuckets(hitsPerRun: number[], yieldPerRun: number[], bucketCount = TIMELINE_BUCKET_COUNT): TimelineBucket[] {
  if (hitsPerRun.length === 0 || bucketCount <= 0) {
    return [];
  }
  const buckets: TimelineBucket[] = [];
  const size = Math.max(1, Math.ceil(hitsPerRun.length / bucketCount));
  for (let index = 0; index < hitsPerRun.length; index += size) {
    const start = index;
    const end = Math.min(hitsPerRun.length, index + size);
    let hits = 0;
    let totalYield = 0;
    let appeared = false;
    for (let i = start; i < end; i += 1) {
      const hitCount = hitsPerRun[i] ?? 0;
      const yieldCount = yieldPerRun[i] ?? 0;
      hits += hitCount;
      totalYield += yieldCount;
      if (!appeared && hitCount > 0) {
        appeared = true;
      }
    }
    buckets.push({
      start: start + 1,
      end,
      hits,
      yield: totalYield,
      appeared,
    });
  }
  return buckets;
}

function percentage(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

function Metric({ label, value, tooltip }: { label: string; value: ReactNode; tooltip?: string }) {
  return (
    <div className="flex items-center justify-between" title={tooltip}>
      <span className="text-foreground/60">{label}</span>
      <span className="font-semibold text-foreground/90">{value}</span>
    </div>
  );
}

function TimelineRowViz({
  label,
  buckets,
  accessor,
  color,
  maxValue,
  tooltipFormatter,
}: {
  label: string;
  buckets: TimelineBucket[];
  accessor: (bucket: TimelineBucket) => number;
  color: string;
  maxValue?: number;
  tooltipFormatter?: (value: number, bucket: TimelineBucket) => string;
}) {
  const values = buckets.map((bucket) => accessor(bucket));
  const computedMax = maxValue ?? (values.length > 0 ? Math.max(...values) : 0);

  return (
    <div>
      <div className="mb-1 text-[0.65rem] uppercase tracking-wide text-foreground/50">{label}</div>
      <div className="flex h-12 items-end gap-[2px] overflow-hidden rounded-md bg-white/5 p-[3px]">
        {buckets.map((bucket, index) => {
          const value = values[index] ?? 0;
          const height = computedMax === 0 ? 0 : Math.min(100, (value / computedMax) * 100);
          const tooltip = tooltipFormatter ? tooltipFormatter(value, bucket) : `${label}: ${value.toLocaleString()} (${bucket.start}–${bucket.end})`;
          return (
            <div key={`${label}-${bucket.start}-${bucket.end}-${index}`} className="relative flex-1">
              <div
                className="absolute bottom-0 left-0 right-0 rounded-[2px]"
                style={{
                  height: `${height}%`,
                  background: color,
                  opacity: value === 0 ? 0.12 : 0.85,
                  transition: 'height 150ms ease-out',
                }}
                title={tooltip}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProbabilityBar({ baseShare, observedShare }: { baseShare: number; observedShare: number }) {
  const clamp = (value: number) => Math.max(0, Math.min(100, value * 100));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[0.7rem] uppercase tracking-wide text-foreground/50">
        <span>Probability weight</span>
        <span>{percentage(baseShare)}</span>
      </div>
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-white/20"
          style={{ width: `${clamp(baseShare)}%` }}
          title={`Base share ${percentage(baseShare)}`}
        />
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-primary"
          style={{ width: `${clamp(observedShare)}%`, opacity: 0.85 }}
          title={`Observed hit share ${percentage(observedShare)}`}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-foreground/60">
        <span>Simulated frequency</span>
        <span>{percentage(observedShare)}</span>
      </div>
    </div>
  );
}

function EntryDetailPanel({ entry, totalRuns, totalRolls }: { entry: DecoratedEntry; totalRuns: number; totalRolls: number }) {
  const timelineBuckets = buildTimelineBuckets(entry.hitsPerRun, entry.yieldPerRun);
  const appearanceRate = totalRuns === 0 ? 0 : entry.bundleHits / totalRuns;
  const hitRate = totalRuns === 0 ? 0 : entry.rollHits / totalRuns;
  const expectedHits = entry.baseProbability * totalRolls;
  const expectedHitsPerRun = totalRuns === 0 ? 0 : expectedHits / totalRuns;
  const heatRatio = entry.heatRatio;
  const heatDelta = heatRatio === null ? null : heatRatio - 1;

  let heatVariant: 'default' | 'info' | 'destructive' = 'default';
  if (heatRatio !== null) {
    if (heatRatio >= 1.05) {
      heatVariant = 'info';
    } else if (heatRatio <= 0.95) {
      heatVariant = 'destructive';
    }
  }

  const heatCopy = (() => {
    if (heatRatio === null) return 'No baseline probability available';
    if (heatRatio >= 1.05) return `Running hot (+${(heatDelta! * 100).toFixed(1)}% vs expected)`;
    if (heatRatio <= 0.95) return `Running cold (${(heatDelta! * 100).toFixed(1)}% vs expected)`;
    return 'Tracking expectation';
  })();

  const heatBadgeText = heatRatio === null ? 'Heat: N/A' : `Heat: ${heatCopy}`;
  const heatTitle =
    heatRatio === null
      ? 'No baseline probability for this entry'
      : `Observed vs expected frequency difference ${(heatDelta! * 100).toFixed(1)}%`;

  const runsPerBucket =
    timelineBuckets.length === 0 ? 0 : Math.max(1, Math.ceil(totalRuns / timelineBuckets.length));

  return (
    <div className="mt-6 rounded-2xl border border-primary/30 bg-primary/5 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-semibold text-white">Detailed insight: {entry.name}</h3>
        <Badge variant={heatVariant} title={heatTitle}>
          {heatBadgeText}
        </Badge>
      </div>
      <div className="mt-4 grid gap-3 text-sm text-foreground/80 sm:grid-cols-2">
        <Metric label="Entry type" value={entry.type === 'dropped_item' ? 'Dropped item' : 'Given item'} />
        <Metric label="Total yielded" value={entry.totalDrops.toLocaleString()} />
        <Metric label="Roll hits" value={entry.rollHits.toLocaleString()} />
        <Metric label="Distinct bundles" value={entry.bundleHits.toLocaleString()} />
        <Metric label="Appearance rate" value={percentage(appearanceRate)} />
        <Metric label="Hits/run" value={hitRate.toFixed(2)} tooltip="Average roll hits per run" />
        <Metric label="Simulated hit share" value={percentage(entry.probability)} />
        <Metric label="Base weight share" value={percentage(entry.baseProbability)} />
        <Metric label="Yield/run" value={entry.perRunAverage.toFixed(2)} />
        <Metric
          label="First appearance"
          value={entry.firstAppearedAt ? `Roll #${entry.firstAppearedAt}` : 'Never'}
        />
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <ProbabilityBar baseShare={entry.baseProbability} observedShare={entry.probability} />
        <div className="space-y-2 text-sm text-foreground/70">
          <Metric label="Expected hits" value={expectedHits.toFixed(1)} tooltip="Base probability × total rolls" />
          <Metric label="Expected hits/run" value={expectedHitsPerRun.toFixed(2)} />
          <p className="text-xs text-foreground/50">
            Heat compares simulated hit share to the base probability weight. Bars below show how often and how heavily this
            entry appeared across the simulation timeline.
          </p>
        </div>
      </div>
      <div className="mt-6 space-y-3">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground/60">Mini timeline</h4>
          <p className="text-xs text-foreground/50">
            {timelineBuckets.length === 0
              ? 'No recorded rolls for this entry in the current simulation.'
              : `Each bar aggregates roughly ${runsPerBucket} run${runsPerBucket === 1 ? '' : 's'}.`}
          </p>
        </div>
        {timelineBuckets.length > 0 ? (
          <div className="space-y-3">
            <TimelineRowViz
              label="Appearances"
              buckets={timelineBuckets}
              accessor={(bucket) => (bucket.appeared ? 1 : 0)}
              color="rgba(255,255,255,0.75)"
              maxValue={1}
              tooltipFormatter={(value, bucket) =>
                value > 0
                  ? `Appeared between runs ${bucket.start}–${bucket.end}`
                  : `No appearances between runs ${bucket.start}–${bucket.end}`
              }
            />
            <TimelineRowViz
              label="Roll hits"
              buckets={timelineBuckets}
              accessor={(bucket) => bucket.hits}
              color="hsl(var(--primary))"
              tooltipFormatter={(value, bucket) =>
                `Hits: ${value.toLocaleString()} (runs ${bucket.start}–${bucket.end})`
              }
            />
            <TimelineRowViz
              label="Yielded"
              buckets={timelineBuckets}
              accessor={(bucket) => bucket.yield}
              color="rgba(56,189,248,0.85)"
              tooltipFormatter={(value, bucket) =>
                `Yielded: ${value.toLocaleString()} (runs ${bucket.start}–${bucket.end})`
              }
            />
          </div>
        ) : (
          <p className="text-xs text-foreground/50">No timeline data recorded for this entry.</p>
        )}
      </div>
    </div>
  );
}

export function SimulationDrawer({ open, onClose, definition, probabilities, items }: SimulationDrawerProps) {
  const [runs, setRuns] = useState(1000);
  const [seed, setSeed] = useState('');
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<'yielded' | 'rollHits' | 'bundleHits' | 'name'>('yielded');
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

  const rawRows = useMemo<DecoratedEntry[]>(() => {
    if (!result) return [] as DecoratedEntry[];
    return result.entries.map((entry) => {
      const baseProbability = probabilities[entry.entryId] ?? 0;
      const item = items.find((candidate) => candidate.id === entry.itemId);
      return {
        ...entry,
        baseProbability,
        name: item?.name ?? entry.itemId,
        heatRatio: baseProbability > 0 ? entry.probability / baseProbability : null,
      } satisfies DecoratedEntry;
    });
  }, [items, probabilities, result]);

  const tableRows = useMemo(() => {
    const rows = [...rawRows];
    rows.sort((a, b) => {
      switch (sortKey) {
        case 'rollHits':
          return b.rollHits - a.rollHits;
        case 'bundleHits':
          return b.bundleHits - a.bundleHits;
        case 'name':
          return a.name.localeCompare(b.name);
        case 'yielded':
        default:
          return b.totalDrops - a.totalDrops;
      }
    });
    return rows;
  }, [rawRows, sortKey]);

  const totalYield = useMemo(
    () => result?.entries.reduce((sum, entry) => sum + entry.totalDrops, 0) ?? 0,
    [result],
  );

  const selectedEntryData = useMemo(() => {
    if (!selectedEntry) return null;
    return (
      tableRows.find((entry) => entry.entryId === selectedEntry) ??
      rawRows.find((entry) => entry.entryId === selectedEntry) ??
      null
    );
  }, [rawRows, selectedEntry, tableRows]);

  useEffect(() => {
    if (selectedEntry && !selectedEntryData) {
      setSelectedEntry(null);
    }
  }, [selectedEntry, selectedEntryData]);

  useEffect(() => {
    if (!selectedEntry && tableRows.length > 0) {
      setSelectedEntry(tableRows[0].entryId);
    }
  }, [selectedEntry, tableRows]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm">
      <div className="glass-panel flex h-full w-full max-w-6xl flex-col border-l border-white/10 px-6 py-6 lg:px-10">
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
                    <span>Total yielded</span>
                    <span className="font-semibold">{totalYield.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Total rolls</span>
                    <span className="font-semibold">{result.totalRolls.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Avg rolls/run</span>
                    <span className="font-semibold">{result.runs === 0 ? '0.00' : (result.totalRolls / result.runs).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Avg yielded/run</span>
                    <span className="font-semibold">{result.runs === 0 ? '0.00' : (totalYield / result.runs).toFixed(2)}</span>
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
          <CardHeader className="flex flex-col gap-4 border-b border-white/5 pb-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Per-entry results</CardTitle>
              <CardDescription>
                Compare base probability weight to observed roll frequency, yield, and bundle impact. Sort to focus on the
                densest performers.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-foreground/60">
              <Label htmlFor="sort-by" className="text-[0.7rem] font-semibold uppercase tracking-wider">
                Sort by
              </Label>
              <Select value={sortKey} onValueChange={(value) => setSortKey(value as typeof sortKey)}>
                <SelectTrigger id="sort-by" className="w-[160px] bg-black/40">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yielded">Most yielded</SelectItem>
                  <SelectItem value="rollHits">Roll hits</SelectItem>
                  <SelectItem value="bundleHits">Bundles hit</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="flex h-full flex-col">
            <ScrollArea className="flex-1 min-h-[400px] max-h-[600px] rounded-xl border border-white/10 bg-black/40">
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
                      className={`border-b border-white/5 cursor-pointer transition-colors hover:bg-primary/10 ${selectedEntry === entry.entryId ? 'bg-primary/20' : ''}`}
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
            {selectedEntryData && result && (
              <EntryDetailPanel entry={selectedEntryData} totalRuns={result.runs} totalRolls={result.totalRolls} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
