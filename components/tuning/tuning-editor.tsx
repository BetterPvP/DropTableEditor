'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { saveTuningRowAction, deleteTuningRowAction } from '@/lib/tuning/actions';

interface Row {
  key: string;
  definition: unknown;
}

interface TuningEditorProps {
  slug: string;
  label: string;
  description: string;
  keyColumn: string;
  sample: { key: string; definition: unknown };
  rows: Row[];
}

export function TuningEditor({ slug, label, description, keyColumn, sample, rows }: TuningEditorProps) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{label}</h1>
        <p className="text-sm text-foreground/60">{description}</p>
      </div>

      <AddRow slug={slug} keyColumn={keyColumn} sample={sample} />

      {rows.length === 0 ? (
        <div className="glass-panel rounded-lg border p-8 text-center text-foreground/50">No rows yet.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((row) => (
            <RowCard key={row.key} slug={slug} keyColumn={keyColumn} rowKey={row.key} definition={row.definition} />
          ))}
        </div>
      )}
    </div>
  );
}

function RowCard({ slug, keyColumn, rowKey, definition }: { slug: string; keyColumn: string; rowKey: string; definition: unknown }) {
  const router = useRouter();
  const [text, setText] = useState(JSON.stringify(definition, null, 2));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    setError(null);
    const result = await saveTuningRowAction(slug, rowKey, text);
    setSaving(false);
    if (!result.ok) setError(result.error);
    else router.refresh();
  };

  const remove = async () => {
    if (!window.confirm(`Delete ${rowKey}?`)) return;
    await deleteTuningRowAction(slug, rowKey);
    router.refresh();
  };

  return (
    <div className="glass-panel rounded-lg border p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="info">{keyColumn}</Badge>
          <span className="font-mono text-sm">{rowKey}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={save} disabled={saving}>
            <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button type="button" size="sm" variant="destructive" className="gap-2" onClick={remove}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={Math.min(20, text.split('\n').length + 1)} className="font-mono text-xs" />
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}

function AddRow({ slug, keyColumn, sample }: { slug: string; keyColumn: string; sample: { key: string; definition: unknown } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState('');
  const [text, setText] = useState(JSON.stringify(sample.definition, null, 2));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const create = async () => {
    setSaving(true);
    setError(null);
    const result = await saveTuningRowAction(slug, key, text);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setKey('');
    setOpen(false);
    router.refresh();
  };

  if (!open) {
    return (
      <Button type="button" variant="outline" className="w-fit gap-2" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Add row
      </Button>
    );
  }

  return (
    <div className="glass-panel rounded-lg border p-4">
      <div className="mb-2 flex items-end gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide text-foreground/50">{keyColumn}</Label>
          <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder={sample.key} className="w-56" />
        </div>
        <Button type="button" className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={create} disabled={saving}>
          <Save className="h-4 w-4" /> {saving ? 'Creating…' : 'Create'}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={10} className="font-mono text-xs" />
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}
