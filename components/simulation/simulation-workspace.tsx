'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { LootTableDefinition, SimulationResult } from '@/lib/content/loot_table/schema';

interface Props {
  id: string;
  name: string;
  definition: LootTableDefinition;
}

function entryLabel(e: SimulationResult['entries'][number]): string {
  return e.itemId ?? e.entryId.slice(0, 8);
}

export function SimulationWorkspace({ id, name, definition }: Props) {
  const workerRef = useRef<Worker | null>(null);
  const [runs, setRuns] = useState(10000);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<SimulationResult | null>(null);

  useEffect(() => () => workerRef.current?.terminate(), []);

  const run = () => {
    workerRef.current?.terminate();
    const worker = new Worker(new URL('../../lib/workers/simulation.worker.ts', import.meta.url));
    workerRef.current = worker;
    setRunning(true);
    setProgress(0);
    setResult(null);

    worker.onmessage = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === 'progress') {
        setProgress(msg.total > 0 ? msg.completed / msg.total : 0);
      } else if (msg.type === 'complete') {
        setResult(msg.result as SimulationResult);
        setRunning(false);
        worker.terminate();
        workerRef.current = null;
      }
    };

    worker.postMessage({ type: 'start', definition, runs });
  };

  const chartData = result
    ? [...result.entries].sort((a, b) => b.probability - a.probability).map((e) => ({
        name: entryLabel(e),
        probability: Number((e.probability * 100).toFixed(2)),
      }))
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-1">
        <Link href={`/loot-tables/${id}`} className="text-sm text-foreground/50 hover:text-primary">← {name}</Link>
        <h1 className="text-2xl font-semibold">Simulate · {name}</h1>
        <p className="text-sm text-foreground/60">
          Monte-Carlo preview using the in-browser roller. EXPRESSION weights use their fallback/preview value.
        </p>
      </div>

      <div className="glass-panel flex items-end gap-4 rounded-lg border p-4">
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide text-foreground/50">Runs</Label>
          <Input type="number" className="w-40" value={runs} onChange={(e) => setRuns(Math.max(1, parseInt(e.target.value, 10) || 1))} />
        </div>
        <Button type="button" onClick={run} disabled={running}>{running ? 'Running…' : 'Run simulation'}</Button>
        {running && (
          <div className="flex-1">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          </div>
        )}
      </div>

      {result && (
        <>
          <div className="glass-panel rounded-lg border p-4">
            <div className="mb-3 text-sm text-foreground/60">
              {result.runs.toLocaleString()} runs · {result.totalRolls.toLocaleString()} rolls · {result.durationMs} ms
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 40, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" angle={-30} textAnchor="end" interval={0} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} unit="%" />
                  <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))' }} />
                  <Bar dataKey="probability" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-panel overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-foreground/50">
                <tr>
                  <th className="px-4 py-2">Entry</th>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2 text-right">Drop chance</th>
                  <th className="px-4 py-2 text-right">Avg / run</th>
                  <th className="px-4 py-2 text-right">Total drops</th>
                </tr>
              </thead>
              <tbody>
                {result.entries.map((e) => (
                  <tr key={e.entryId} className="border-t border-border/50">
                    <td className="px-4 py-2">{entryLabel(e)}</td>
                    <td className="px-4 py-2 text-foreground/60">{e.type}</td>
                    <td className="px-4 py-2 text-right">{(e.probability * 100).toFixed(2)}%</td>
                    <td className="px-4 py-2 text-right">{e.perRunAverage.toFixed(3)}</td>
                    <td className="px-4 py-2 text-right">{e.totalDrops.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
