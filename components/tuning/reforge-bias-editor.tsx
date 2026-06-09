'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CardActions } from './card-actions';
import { PURITIES, purityMeta } from '@/lib/tuning/purity';
import { saveTuningRowAction, publishTuningRowAction, deleteTuningRowAction } from '@/lib/tuning/actions';

interface Row { key: string; definition: unknown; unpublished: boolean }

function betaCurve(alpha: number, beta: number) {
  if (alpha <= 0 || beta <= 0) return [];
  const points: { x: number; y: number }[] = [];
  for (let i = 1; i < 40; i++) {
    const x = i / 40;
    points.push({ x: Math.round(x * 100), y: Math.pow(x, alpha - 1) * Math.pow(1 - x, beta - 1) });
  }
  const max = Math.max(...points.map((p) => p.y), 1e-9);
  return points.map((p) => ({ x: p.x, y: p.y / max }));
}

export function ReforgeBiasEditor({ slug, rows }: { slug: string; rows: Row[] }) {
  const present = new Set(rows.map((r) => r.key));
  const missing = PURITIES.filter((p) => !present.has(p.key));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Reforge Bias</h1>
        <p className="text-sm text-foreground/60">
          When an item is reforged, each stat is rolled between its min and max using a <strong>Beta distribution</strong>.
          <strong> Alpha (α)</strong> pulls rolls toward the <em>maximum</em>; <strong>Beta (β)</strong> pulls them toward the
          <em> minimum</em>. So α &gt; β favours great stats, α &lt; β favours poor stats, and α = β is an even spread.
          Both must be greater than 0. The average roll is <code>α / (α + β)</code> of the way to max.
        </p>
      </div>

      {missing.length > 0 && <AddBias slug={slug} missing={missing.map((p) => p.key)} />}

      {PURITIES.filter((p) => present.has(p.key)).map((p) => {
        const row = rows.find((r) => r.key === p.key)!;
        return <BiasCard key={p.key} slug={slug} purity={p.key} definition={row.definition} unpublished={row.unpublished} />;
      })}
    </div>
  );
}

function BiasCard({ slug, purity, definition, unpublished }: { slug: string; purity: string; definition: unknown; unpublished: boolean }) {
  const router = useRouter();
  const d = (definition ?? {}) as { alpha?: number; beta?: number; notes?: string };
  const [alpha, setAlpha] = useState<number>(typeof d.alpha === 'number' ? d.alpha : 1);
  const [beta, setBeta] = useState<number>(typeof d.beta === 'number' ? d.beta : 1);
  const [notes, setNotes] = useState<string>(d.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meta = purityMeta(purity);
  const mean = alpha + beta > 0 ? alpha / (alpha + beta) : 0;
  const skew = alpha > beta ? 'favours high stats' : alpha < beta ? 'favours low stats' : 'even spread';
  const curve = useMemo(() => betaCurve(alpha, beta), [alpha, beta]);

  const run = async (action: (slug: string, key: string, text: string) => Promise<{ ok: true } | { ok: false; error: string }>) => {
    if (alpha <= 0 || beta <= 0) { setError('Alpha and Beta must both be greater than 0.'); return; }
    setBusy(true); setError(null);
    const result = await action(slug, purity, JSON.stringify({ purity, alpha, beta, notes }));
    setBusy(false);
    if (!result.ok) setError(result.error); else router.refresh();
  };
  const save = () => run(saveTuningRowAction);
  const publish = () => run(publishTuningRowAction);

  const remove = async () => {
    if (!window.confirm(`Delete bias for ${purity}?`)) return;
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
        <CardActions unpublished={unpublished} busy={busy} onSave={save} onPublish={publish} onDelete={remove} />
      </div>

      <div className="grid gap-5 md:grid-cols-[260px_1fr]">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-foreground/50">Alpha (α) — pull toward max</Label>
            <Input type="number" step="0.1" min={0.1} value={alpha} onChange={(e) => setAlpha(parseFloat(e.target.value) || 0)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-foreground/50">Beta (β) — pull toward min</Label>
            <Input type="number" step="0.1" min={0.1} value={beta} onChange={(e) => setBeta(parseFloat(e.target.value) || 0)} />
          </div>
          <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-sm">
            <div>Average roll: <strong>{(mean * 100).toFixed(0)}%</strong> of max</div>
            <div className="text-foreground/60">{skew}</div>
          </div>
        </div>

        <div>
          <div className="h-36 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={curve} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <XAxis dataKey="x" type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} unit="%" />
                <YAxis hide domain={[0, 1]} />
                <Line type="monotone" dataKey="y" stroke={meta?.color ?? 'hsl(var(--primary))'} dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-between px-1 text-xs text-foreground/40">
            <span>← worse stats</span><span>better stats →</span>
          </div>
          <div className="mt-3 space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-foreground/50">Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}

function AddBias({ slug, missing }: { slug: string; missing: string[] }) {
  const router = useRouter();
  const [purity, setPurity] = useState('');
  const create = async () => {
    if (!purity) return;
    await saveTuningRowAction(slug, purity, JSON.stringify({ purity, alpha: 1, beta: 1, notes: '' }));
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
