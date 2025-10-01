'use client';

import { useMemo, useState } from 'react';
import { type LootTableMeta } from '@/lib/loot-tables/sample';
import { useAutosave } from '@/lib/hooks/use-autosave';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SaveIndicator } from '@/components/save-indicator';
import { JSONPreview } from './json-preview';
import { OpenTabsPanel } from './open-tabs-panel';
import { SimulationDrawer } from '@/components/simulation/simulation-drawer';
import { Download, Share2, Wand2 } from 'lucide-react';

interface LootTableEditorProps {
  table: LootTableMeta;
}

export function LootTableEditor({ table }: LootTableEditorProps) {
  const [metadata, setMetadata] = useState({
    name: table.name,
    description: table.description ?? '',
    notes: '',
  });
  const [simulationOpen, setSimulationOpen] = useState(false);

  const autosave = useAutosave({
    key: `loot-table:${table.id}`,
    version: table.version,
    value: metadata,
    onSave: async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      console.info('Saved metadata for', table.id, metadata);
    },
  });

  const inspectorStats = useMemo(() => {
    const pools = Array.isArray((table.data as any)?.pools) ? ((table.data as any).pools as any[]) : [];
    const entries = pools.reduce((acc, pool) => acc + (Array.isArray(pool.entries) ? pool.entries.length : 0), 0);
    return {
      pools: pools.length,
      entries,
    };
  }, [table.data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-slate-900/60 px-6 py-4 backdrop-blur-xl">
        <div>
          <h1 className="text-2xl font-semibold text-white">{metadata.name}</h1>
          <p className="text-sm text-foreground/60">Version {table.version} · Last updated {new Date(table.updated_at).toLocaleString()}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SaveIndicator status={autosave.status} />
          <Button variant="outline" className="gap-2" onClick={() => setSimulationOpen(true)}>
            <Wand2 className="h-4 w-4" /> Run simulation
          </Button>
          <Button variant="ghost" className="gap-2">
            <Share2 className="h-4 w-4" /> Share link
          </Button>
          <Button className="gap-2">
            <Download className="h-4 w-4" /> Export JSON
          </Button>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[260px_1fr_320px]">
        <div className="glass-panel hidden rounded-3xl border border-white/10 lg:flex">
          <OpenTabsPanel activeId={table.id} />
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Metadata</CardTitle>
                <CardDescription>Update the title and helper text for this loot table.</CardDescription>
              </div>
              <Badge variant="info">Autosave active</Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={metadata.name}
                  onChange={(event) => setMetadata((prev) => ({ ...prev, name: event.target.value }))}
                  onBlur={autosave.handleBlur}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={metadata.description}
                  onChange={(event) => setMetadata((prev) => ({ ...prev, description: event.target.value }))}
                  onBlur={autosave.handleBlur}
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Designer notes</Label>
                <Textarea
                  id="notes"
                  value={metadata.notes}
                  onChange={(event) => setMetadata((prev) => ({ ...prev, notes: event.target.value }))}
                  onBlur={autosave.handleBlur}
                  rows={5}
                />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Pools</CardTitle>
              <CardDescription>Visual editor coming soon. JSON structure remains intact for export parity.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 text-sm text-foreground/70">
                {Array.isArray((table.data as any)?.pools) ? (
                  (table.data as any).pools.map((pool: any, index: number) => (
                    <div key={index} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-center justify-between text-foreground">
                        <span className="font-semibold">Pool {index + 1}</span>
                        <Badge variant="default">{pool.rolls?.min ?? 1}-{pool.rolls?.max ?? 1} rolls</Badge>
                      </div>
                      <p className="text-xs uppercase tracking-wide text-foreground/40">{pool.entries?.length ?? 0} entries</p>
                    </div>
                  ))
                ) : (
                  <p>No pools defined.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Inspector</CardTitle>
              <CardDescription>Quick health check before exporting.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-foreground/60">Pools</span>
                <Badge variant="default">{inspectorStats.pools}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-foreground/60">Entries</span>
                <Badge variant="default">{inspectorStats.entries}</Badge>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/40 p-4 text-xs text-foreground/60">
                <p>
                  Conflict detection, validation, and schema parity checks will surface here with actionable next steps. For now this
                  panel provides contextual stats only.
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>JSON Preview</CardTitle>
              <CardDescription>Read-only view used for parity tests.</CardDescription>
            </CardHeader>
            <CardContent>
              <JSONPreview data={table.data} />
            </CardContent>
          </Card>
        </div>
      </div>
      <SimulationDrawer open={simulationOpen} onClose={() => setSimulationOpen(false)} />
    </div>
  );
}
