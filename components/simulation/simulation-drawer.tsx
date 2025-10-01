'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BarChart3 } from 'lucide-react';

interface SimulationDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function SimulationDrawer({ open, onClose }: SimulationDrawerProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm">
      <div className="glass-panel flex h-full w-full max-w-xl flex-col border-l border-white/10 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Simulation</h2>
            <p className="text-sm text-foreground/60">Run Monte Carlo trials in a dedicated worker thread.</p>
          </div>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="mt-6 grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Parameters</CardTitle>
              <CardDescription>Choose the number of runs and deterministic seed.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="runs">Runs</Label>
                <Input id="runs" type="number" defaultValue={1000} min={1} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seed">Seed</Label>
                <Input id="seed" placeholder="Optional seed" />
              </div>
              <Button type="button" className="justify-between">
                Execute
                <BarChart3 className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Results</CardTitle>
              <CardDescription>Progressively updates as batches finish.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-48 rounded-xl border border-white/10 bg-black/40 p-4 text-xs text-foreground/70">
                <p>Simulation results will appear here once implemented.</p>
                <p className="mt-2">
                  The new worker-based engine will stream per-item stats, percentiles, and histograms.
                </p>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
