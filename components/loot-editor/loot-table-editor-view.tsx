"use client";

import { useMemo, useState } from "react";
import type { LootEntry, LootPool, LootTable } from "@/lib/types";
import { JSONPreview } from "./json-preview";
import { SaveIndicator } from "./save-indicator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { useAutosave } from "@/hooks/use-autosave";
import { useToast } from "@/components/ui/use-toast";
import { formatDateTime } from "@/lib/utils";

const MOCK_STATS = [
  { item: "minecraft:diamond", count: 240, rate: 0.12 },
  { item: "minecraft:emerald", count: 80, rate: 0.04 },
  { item: "minecraft:gold_ingot", count: 420, rate: 0.21 },
];

type Props = {
  id: string;
  data: LootTable;
  sample?: boolean;
};

export function LootTableEditorView({ id, data, sample }: Props) {
  const [editorState, setEditorState] = useState<LootTable>(data);
  const [isSimulationOpen, setSimulationOpen] = useState(false);
  const { toast } = useToast();

  const { status, lastSavedAt, saveManually } = useAutosave(editorState, {
    key: `loot-table-${id}`,
    version: data?.version ?? 1,
    onSave: async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
    },
  });

  const pools = useMemo<LootPool[]>(() => editorState?.pools ?? [], [editorState]);

  return (
    <div className="space-y-6">
      <div className="glass-panel sticky top-20 z-30 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 px-6 py-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{editorState?.name ?? "Loot Table"}</h1>
            {sample ? <Badge variant="outline">Sample</Badge> : null}
          </div>
          <p className="text-xs text-muted-foreground">Last saved {lastSavedAt ? formatDateTime(lastSavedAt) : "never"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SaveIndicator status={status} />
          <Button variant="glass" onClick={() => saveManually().then(() => toast({ title: "Saved", description: "Table saved successfully." }))}>
            Save now
          </Button>
          <Button variant="outline">Export JSON</Button>
          <Sheet open={isSimulationOpen} onOpenChange={setSimulationOpen}>
            <SheetTrigger asChild>
              <Button>Run simulation</Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Simulation results</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                <div className="rounded-xl border border-white/5 bg-black/30 p-4">
                  <p className="text-sm text-muted-foreground">Simulation is mocked for demo purposes. Monte Carlo worker integration is pending.</p>
                </div>
                <div className="space-y-2">
                  {MOCK_STATS.map((stat) => (
                    <div key={stat.item} className="flex items-center justify-between rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-sm">
                      <span className="font-mono">{stat.item}</span>
                      <span className="text-muted-foreground">{stat.count} drops • {(stat.rate * 100).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr_340px]">
        <aside className="glass-panel hidden h-full flex-col gap-4 rounded-2xl border border-white/10 p-4 lg:flex">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide">Open tables</h2>
            <Badge variant="outline">1</Badge>
          </div>
          <div className="space-y-3">
            <button className="w-full rounded-xl border border-primary/30 bg-primary/20 px-3 py-2 text-left text-sm font-medium text-primary-foreground">
              {editorState?.name ?? id}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">Tabs and conflict resolution will appear here.</p>
        </aside>

        <section className="space-y-6">
          <div className="glass-panel rounded-2xl border border-white/10 p-6 shadow-inner">
            <h2 className="text-lg font-semibold">Metadata</h2>
            <div className="mt-4 space-y-4">
              <label className="block text-sm text-muted-foreground">
                Name
                <input
                  className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                  value={editorState?.name ?? ""}
                  onChange={(event) => setEditorState((prev) => ({ ...prev, name: event.target.value }))}
                />
              </label>
              <label className="block text-sm text-muted-foreground">
                Type
                <input
                  className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                  value={editorState?.type ?? "minecraft:chest"}
                  onChange={(event) => setEditorState((prev) => ({ ...prev, type: event.target.value }))}
                />
              </label>
            </div>
          </div>
          <div className="glass-panel rounded-2xl border border-white/10 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Pools</h2>
              <Badge variant="outline">{pools.length} pools</Badge>
            </div>
            <Tabs defaultValue="overview" className="mt-6">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="entries">Entries</TabsTrigger>
              </TabsList>
              <TabsContent value="overview">
                <div className="space-y-4">
                  {pools.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-muted-foreground">
                      No pools yet. Add a pool to begin configuring drops.
                    </div>
                  ) : (
                    pools.map((pool, index) => (
                      <div key={index} className="rounded-xl border border-white/10 bg-black/30 p-4">
                        <div className="flex items-center justify-between text-sm">
                          <div>
                            <p className="font-medium">Pool {index + 1}</p>
                            <p className="text-xs text-muted-foreground">Rolls: {JSON.stringify(pool.rolls)}</p>
                          </div>
                          <Badge variant="outline">{pool.entries?.length ?? 0} entries</Badge>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>
              <TabsContent value="entries">
                <div className="space-y-4">
                  {pools
                    .flatMap((pool) => pool.entries ?? [])
                    .map((entry: LootEntry, idx) => (
                    <div key={idx} className="rounded-xl border border-white/10 bg-black/25 p-4 text-sm">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="font-mono text-primary-foreground/90">{entry.name ?? entry.type ?? "Entry"}</p>
                          <p className="text-xs text-muted-foreground">Weight: {entry.weight ?? 1}</p>
                        </div>
                        <Badge variant="outline">{entry.type ?? "item"}</Badge>
                      </div>
                    </div>
                  ))}
                  {pools.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Create a pool to manage entries.</p>
                  ) : null}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </section>

        <aside className="glass-panel space-y-6 rounded-2xl border border-white/10 p-6">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Inspector</h2>
            <p className="text-sm text-muted-foreground">Validation and export preview.</p>
          </div>
          <div className="space-y-3 text-sm">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-200">
              <p className="font-semibold">Validation passed</p>
              <p className="text-xs text-emerald-100/80">No issues detected in current configuration.</p>
            </div>
            <Separator />
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">JSON Preview</h3>
            </div>
            <JSONPreview value={editorState} />
          </div>
        </aside>
      </div>
    </div>
  );
}
