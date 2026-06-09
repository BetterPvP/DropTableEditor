'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PURITIES, purityMeta, readWeights } from '@/lib/tuning/purity';
import { saveTuningRowAction, deleteTuningRowAction } from '@/lib/tuning/actions';

interface Row { key: string; definition: unknown }

const SLOTS = ['0', '1', '2', '3', '4'];

export function RuneSlotEditor({ slug, rows }: { slug: string; rows: Row[] }) {
  const present = new Set(rows.map((r) => r.key));
  const missing = PURITIES.filter((p) => !present.has(p.key)).map((p) => p.key);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Rune-Slot Distributions</h1>
        <p className="text-sm text-foreground/60">
          When an item is attuned it rolls a number of <strong>rune sockets</strong> (0–4) and a separate{' '}
          <strong>maximum socket cap</strong> (0–4), each by relative weight. Higher-purity items usually weight the
          higher socket counts. Percentages update as you edit.
        </p>
      </div>

      {missing.length > 0 && <AddRuneSlot slug={slug} missing={missing} />}

      {PURITIES.filter((p) => present.has(p.key)).map((p) => {
        const row = rows.find((r) => r.key === p.key)!;
        return <RuneSlotCard key={p.key} slug={slug} purity={p.key} definition={row.definition} />;
      })}
    </div>
  );
}

function RuneSlotCard({ slug, purity, definition }: { slug: string; purity: string; definition: unknown }) {
  const router = useRouter();
  const d = (definition ?? {}) as { socket_weights?: unknown; max_socket_weights?: unknown; notes?: string };
  const [sockets, setSockets] = useState(readWeights(d.socket_weights, SLOTS));
  const [maxSockets, setMaxSockets] = useState(readWeights(d.max_socket_weights, SLOTS));
  const [notes, setNotes] = useState(d.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const meta = purityMeta(purity);

  const save = async () => {
    setSaving(true);
    setError(null);
    const result = await saveTuningRowAction(slug, purity,
      JSON.stringify({ purity, socket_weights: sockets, max_socket_weights: maxSockets, notes }));
    setSaving(false);
    if (!result.ok) setError(result.error);
    else router.refresh();
  };

  const remove = async () => {
    if (!window.confirm(`Delete rune slots for ${purity}?`)) return;
    await deleteTuningRowAction(slug, purity);
    router.refresh();
  };

  return (
    <div className="glass-panel rounded-lg border p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="flex items-center gap-2 text-lg font-semibold">
          <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: meta?.color }} />
          {meta?.label ?? purity}
        </span>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={save} disabled={saving}>
            <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button type="button" size="sm" variant="destructive" onClick={remove}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <SlotGroup title="Sockets" color={meta?.color} weights={sockets} onChange={setSockets} />
        <SlotGroup title="Max sockets" color={meta?.color} weights={maxSockets} onChange={setMaxSockets} />
      </div>
      <div className="mt-4 space-y-1.5">
        <Label className="text-xs uppercase tracking-wide text-foreground/50">Notes (optional)</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}

function SlotGroup({ title, color, weights, onChange }: {
  title: string; color?: string; weights: Record<string, number>; onChange: (w: Record<string, number>) => void;
}) {
  const total = SLOTS.reduce((sum, s) => sum + (weights[s] || 0), 0);
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-foreground/60">{title}</h3>
      <div className="space-y-2">
        {SLOTS.map((s) => {
          const pct = total > 0 ? ((weights[s] || 0) / total) * 100 : 0;
          return (
            <div key={s} className="flex items-center gap-3">
              <span className="w-16 text-sm text-foreground/70">{s} slot{s === '1' ? '' : 's'}</span>
              <Input type="number" min={0} value={weights[s] ?? 0}
                onChange={(e) => onChange({ ...weights, [s]: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                className="w-20" />
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full" style={{ width: `${pct}%`, backgroundColor: color ?? 'hsl(var(--primary))' }} />
              </div>
              <span className="w-12 text-right text-xs tabular-nums text-foreground/60">{pct.toFixed(0)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AddRuneSlot({ slug, missing }: { slug: string; missing: string[] }) {
  const router = useRouter();
  const [purity, setPurity] = useState('');
  const create = async () => {
    if (!purity) return;
    const flat = Object.fromEntries(SLOTS.map((s) => [s, 1]));
    await saveTuningRowAction(slug, purity,
      JSON.stringify({ purity, socket_weights: flat, max_socket_weights: flat, notes: '' }));
    setPurity('');
    router.refresh();
  };
  return (
    <div className="glass-panel flex items-end gap-2 rounded-lg border p-4">
      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-wide text-foreground/50">Add purity</Label>
        <Select value={purity} onValueChange={setPurity}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Select a purity…" /></SelectTrigger>
          <SelectContent>
            {missing.map((m) => <SelectItem key={m} value={m}>{purityMeta(m)?.label ?? m}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Button type="button" className="bg-emerald-600 hover:bg-emerald-700" onClick={create} disabled={!purity}>Add</Button>
    </div>
  );
}
