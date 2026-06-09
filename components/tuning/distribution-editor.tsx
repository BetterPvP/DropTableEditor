'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PURITIES, readWeights } from '@/lib/tuning/purity';
import { saveTuningRowAction, deleteTuningRowAction } from '@/lib/tuning/actions';

interface Row { key: string; definition: unknown }

export function PurityDistributionEditor({ slug, rows }: { slug: string; rows: Row[] }) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Purity Distributions</h1>
        <p className="text-sm text-foreground/60">
          When an item rolls its purity (rarity), each tier is chosen by <strong>relative weight</strong>. A tier with
          double the weight appears twice as often. Weights don&apos;t need to add up to 100 — the percentages are
          computed for you.
        </p>
      </div>

      {adding ? (
        <div className="glass-panel flex items-end gap-2 rounded-lg border p-4">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-foreground/50">Distribution name</Label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. boss_drop" className="w-64" />
          </div>
          <CreateButton slug={slug} name={newName} onDone={() => { setAdding(false); setNewName(''); }} />
          <Button type="button" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
        </div>
      ) : (
        <Button type="button" variant="outline" className="w-fit gap-2" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" /> New distribution
        </Button>
      )}

      {rows.map((row) => (
        <DistributionCard key={row.key} slug={slug} name={row.key} definition={row.definition} />
      ))}
    </div>
  );
}

function DistributionCard({ slug, name, definition }: { slug: string; name: string; definition: unknown }) {
  const router = useRouter();
  const keys = PURITIES.map((p) => p.key);
  const [weights, setWeights] = useState<Record<string, number>>(
    readWeights((definition as { weights?: unknown })?.weights, keys),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = keys.reduce((sum, k) => sum + (weights[k] || 0), 0);
  const pct = (k: string) => (total > 0 ? ((weights[k] || 0) / total) * 100 : 0);

  const save = async () => {
    setSaving(true);
    setError(null);
    const result = await saveTuningRowAction(slug, name, JSON.stringify({ distribution_name: name, weights }));
    setSaving(false);
    if (!result.ok) setError(result.error);
    else router.refresh();
  };

  const remove = async () => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    await deleteTuningRowAction(slug, name);
    router.refresh();
  };

  return (
    <div className="glass-panel rounded-lg border p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="font-mono text-lg">{name}</span>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={save} disabled={saving}>
            <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button type="button" size="sm" variant="destructive" onClick={remove}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Live stacked rarity bar */}
      <div className="mb-4 flex h-5 w-full overflow-hidden rounded-sm border border-border/60">
        {PURITIES.map((p) => (
          <div key={p.key} style={{ width: `${pct(p.key)}%`, backgroundColor: p.color }} title={`${p.label}: ${pct(p.key).toFixed(1)}%`} />
        ))}
      </div>

      <div className="space-y-2">
        {PURITIES.map((p) => (
          <div key={p.key} className="flex items-center gap-3">
            <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="w-24 text-sm">{p.label}</span>
            <Input
              type="number"
              min={0}
              value={weights[p.key] ?? 0}
              onChange={(e) => setWeights({ ...weights, [p.key]: Math.max(0, parseInt(e.target.value, 10) || 0) })}
              className="w-24"
            />
            <span className="w-16 text-right text-sm tabular-nums text-foreground/70">{pct(p.key).toFixed(1)}%</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-foreground/40">Total weight: {total}</p>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}

function CreateButton({ slug, name, onDone }: { slug: string; name: string; onDone: () => void }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const create = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const weights = Object.fromEntries(PURITIES.map((p) => [p.key, 10]));
    await saveTuningRowAction(slug, name.trim(), JSON.stringify({ distribution_name: name.trim(), weights }));
    setSaving(false);
    onDone();
    router.refresh();
  };
  return (
    <Button type="button" className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={create} disabled={saving}>
      <Save className="h-4 w-4" /> {saving ? 'Creating…' : 'Create'}
    </Button>
  );
}
