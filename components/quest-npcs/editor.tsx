'use client';

import { useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Save, Trash2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  saveQuestNpcAction, deleteQuestNpcAction, fetchPlayerSkinAction, uploadSkinAction,
} from '@/lib/quest-npcs/actions';
import type { QuestNpcRow, FactoryOption } from '@/lib/db/repositories/quest-npcs';

const HUMAN = 'human';

export function QuestNpcsEditor({ npcs, factories }: { npcs: QuestNpcRow[]; factories: FactoryOption[] }) {
  const router = useRouter();
  const [newId, setNewId] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const create = async () => {
    if (!newId.trim()) {
      setAddError('Enter an NPC id first.');
      return;
    }
    setAdding(true);
    setAddError(null);
    try {
      const result = await saveQuestNpcAction({
        id: newId.trim(), displayName: newId.trim(), kind: null, contentId: null,
        source: HUMAN, factory: null, type: null, skinValue: null, skinSignature: null,
      });
      if (!result.ok) {
        setAddError(result.error);
        return;
      }
      setNewId('');
      router.refresh();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to save (is the quest_npcs table created?).');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Quest NPCs</h1>
        <p className="text-sm text-foreground/60">
          Define quest-giver NPCs. Place them in the world with a Mapper <strong>PointRegion</strong> named with the
          NPC&apos;s <strong>id</strong> — the game spawns it there in any world. Each NPC is either a registered
          factory + type (like <code>/npc spawn</code>) or a Human with a custom skin.
        </p>
      </div>

      <div className="glass-panel rounded-lg border p-4">
        <div className="flex items-end gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-foreground/50">New NPC id (= Mapper data-point name)</Label>
            <Input value={newId} onChange={(e) => setNewId(e.target.value)} placeholder="foreman_garrick" className="w-72" />
          </div>
          <Button type="button" className="gap-2" onClick={create} disabled={adding}>
            <Plus className="h-4 w-4" /> {adding ? 'Adding…' : 'Add NPC'}
          </Button>
        </div>
        {addError && <p className="mt-2 text-sm text-destructive">{addError}</p>}
      </div>

      {npcs.map((npc) => (
        <NpcCard key={npc.id} npc={npc} factories={factories} />
      ))}
    </div>
  );
}

function NpcCard({ npc, factories }: { npc: QuestNpcRow; factories: FactoryOption[] }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(npc.displayName);
  const [kind, setKind] = useState(npc.kind ?? 'none');
  const [contentId, setContentId] = useState(npc.contentId ?? '');
  const [sourceSel, setSourceSel] = useState(npc.source === 'factory' ? `${npc.factory}:${npc.type}` : HUMAN);
  const [skinValue, setSkinValue] = useState(npc.skinValue ?? '');
  const [skinSignature, setSkinSignature] = useState(npc.skinSignature ?? '');
  const [skinPlayer, setSkinPlayer] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isHuman = sourceSel === HUMAN;

  const save = async () => {
    setBusy(true); setError(null);
    const [factory, type] = isHuman ? [null, null] : sourceSel.split(':');
    const result = await saveQuestNpcAction({
      id: npc.id, displayName, kind: kind === 'none' ? null : kind, contentId: contentId || null,
      source: isHuman ? HUMAN : 'factory', factory, type,
      skinValue: isHuman ? (skinValue || null) : null,
      skinSignature: isHuman ? (skinSignature || null) : null,
    });
    setBusy(false);
    if (!result.ok) setError(result.error); else router.refresh();
  };

  const remove = async () => {
    if (!window.confirm(`Delete "${npc.id}"?`)) return;
    await deleteQuestNpcAction(npc.id);
    router.refresh();
  };

  const fetchSkin = async () => {
    setBusy(true); setError(null);
    const r = await fetchPlayerSkinAction(skinPlayer);
    setBusy(false);
    if (r.ok) { setSkinValue(r.value); setSkinSignature(r.signature ?? ''); }
    else setError(r.error);
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const base64 = await new Promise<string>((res) => {
      const reader = new FileReader();
      reader.onload = () => res(reader.result as string);
      reader.readAsDataURL(file);
    });
    setBusy(true); setError(null);
    const r = await uploadSkinAction(base64);
    setBusy(false);
    if (r.ok) { setSkinValue(r.value); setSkinSignature(r.signature ?? ''); }
    else setError(r.error);
    e.target.value = '';
  };

  return (
    <div className="glass-panel rounded-lg border p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="font-mono text-lg">{npc.id}</span>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={save} disabled={busy}>
            <Save className="h-4 w-4" /> {busy ? 'Saving…' : 'Save'}
          </Button>
          <Button type="button" size="sm" variant="destructive" onClick={remove}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide text-foreground/50">Display name</Label>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide text-foreground/50">NPC type</Label>
          <Select value={sourceSel} onValueChange={setSourceSel}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={HUMAN}>Human (custom skin)</SelectItem>
              {factories.map((f) => (
                <SelectItem key={`${f.factory}:${f.type}`} value={`${f.factory}:${f.type}`}>{f.factory} : {f.type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide text-foreground/50">On interact</Label>
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nothing</SelectItem>
              <SelectItem value="conversation">Start conversation</SelectItem>
              <SelectItem value="quest">Start quest</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide text-foreground/50">Content id</Label>
          <Input value={contentId} onChange={(e) => setContentId(e.target.value)} placeholder={kind === 'quest' ? 'quest id' : 'conversation id'} disabled={kind === 'none'} />
        </div>
      </div>

      {isHuman && (
        <div className="mt-4 space-y-3 rounded-md border border-border/60 bg-muted/20 p-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold uppercase tracking-wide text-foreground/60">Skin</span>
            {skinValue ? <Badge variant="info" className="gap-1"><Check className="h-3 w-3" /> set</Badge> : <Badge variant="outline">none</Badge>}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-foreground/50">From player name</Label>
              <Input value={skinPlayer} onChange={(e) => setSkinPlayer(e.target.value)} placeholder="Notch" className="w-48" />
            </div>
            <Button type="button" variant="outline" onClick={fetchSkin} disabled={busy || !skinPlayer.trim()}>Fetch skin</Button>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-sm border border-primary/40 bg-primary/12 px-3 py-2 text-sm text-primary hover:bg-primary/18">
              Upload PNG
              <input type="file" accept="image/png" className="hidden" onChange={onFile} />
            </label>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-foreground/50">Texture value (base64)</Label>
            <Textarea value={skinValue} onChange={(e) => setSkinValue(e.target.value)} rows={2} className="font-mono text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-foreground/50">Signature (optional)</Label>
            <Textarea value={skinSignature} onChange={(e) => setSkinSignature(e.target.value)} rows={2} className="font-mono text-xs" />
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}
