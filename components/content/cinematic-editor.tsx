'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { EditorHeader } from '@/components/editor/editor-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useContentEditor } from '@/lib/editor/use-content-editor';
import type { CinematicDefinition, CinematicTrackKind } from '@/lib/content/cinematic/schema';

function genId(p: string): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? `${p}-${crypto.randomUUID().slice(0, 8)}` : `${p}-${Math.random().toString(36).slice(2, 10)}`;
}

const defaultKeyframeData: Record<CinematicTrackKind, () => Record<string, unknown>> = {
  camera: () => ({ x: 0, y: 70, z: 0, yaw: 0, pitch: 0, easing: 'linear' }),
  subtitle: () => ({ text: '', fadeTicks: 10 }),
  sound: () => ({ key: '', volume: 1, pitch: 1 }),
  action: () => ({ eventKey: '' }),
};

const num = (d: Record<string, unknown>, k: string, f = 0) => (typeof d[k] === 'number' ? (d[k] as number) : f);
const str = (d: Record<string, unknown>, k: string, f = '') => (typeof d[k] === 'string' ? (d[k] as string) : f);

export function CinematicEditor(props: {
  id: string;
  initialRevision: number;
  initialDraft: CinematicDefinition;
  manifest: unknown;
}) {
  const editor = useContentEditor<CinematicDefinition>({
    id: props.id, type: 'cinematic', slug: 'cinematics',
    initialDraft: props.initialDraft, initialRevision: props.initialRevision, fallbackName: props.initialDraft.name,
  });
  const { draft, setDraft } = editor;
  const [selected, setSelected] = useState<{ trackId: string; kfId: string } | null>(null);

  const addKeyframe = (trackId: string, kind: CinematicTrackKind) => {
    const id = genId('kf');
    setDraft((d) => ({
      ...d,
      tracks: d.tracks.map((t) => {
        if (t.id !== trackId) return t;
        const lastTick = t.keyframes.reduce((m, k) => Math.max(m, k.tick), 0);
        return { ...t, keyframes: [...t.keyframes, { id, tick: Math.min(lastTick + 20, d.durationTicks), data: defaultKeyframeData[kind]() }] };
      }),
    }));
    setSelected({ trackId, kfId: id });
  };

  const updateKeyframe = (trackId: string, kfId: string, patch: { tick?: number; data?: Record<string, unknown> }) =>
    setDraft((d) => ({
      ...d,
      tracks: d.tracks.map((t) =>
        t.id !== trackId ? t : { ...t, keyframes: t.keyframes.map((k) => (k.id === kfId ? { ...k, ...patch } : k)) },
      ),
    }));

  const removeKeyframe = (trackId: string, kfId: string) => {
    setDraft((d) => ({
      ...d,
      tracks: d.tracks.map((t) => (t.id !== trackId ? t : { ...t, keyframes: t.keyframes.filter((k) => k.id !== kfId) })),
    }));
    setSelected(null);
  };

  const selectedTrack = selected ? draft.tracks.find((t) => t.id === selected.trackId) : undefined;
  const selectedKf = selectedTrack?.keyframes.find((k) => k.id === selected?.kfId);

  return (
    <div className="space-y-4">
      <EditorHeader
        title={draft.name || 'Untitled'}
        contentId={props.id}
        backHref="/cinematics"
        backLabel="Cinematics"
        status={editor.status}
        dirty={editor.dirty}
        isPublishing={editor.isPublishing}
        isDeleting={editor.isDeleting}
        error={editor.error}
        notice={editor.notice}
        draft={draft}
        exportName={draft.name || 'cinematic'}
        onSave={() => editor.saveNow()}
        onPublish={editor.publish}
        onDelete={editor.remove}
        onImport={(parsed) => {
          if (parsed && typeof parsed === 'object' && Array.isArray((parsed as CinematicDefinition).tracks)) {
            setDraft(parsed as CinematicDefinition);
          }
        }}
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <div className="glass-panel flex items-end gap-4 rounded-lg border p-4">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-foreground/50">Name</Label>
              <Input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} className="w-64" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-foreground/50">Duration (ticks)</Label>
              <Input
                type="number"
                value={draft.durationTicks}
                onChange={(e) => setDraft((d) => ({ ...d, durationTicks: parseInt(e.target.value, 10) || 0 }))}
                className="w-32"
              />
            </div>
          </div>

          <div className="space-y-2">
            {draft.tracks.map((track) => (
              <div key={track.id} className="glass-panel rounded-lg border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium">{track.label || track.kind}</span>
                  <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => addKeyframe(track.id, track.kind)}>
                    <Plus className="h-3 w-3" /> Keyframe
                  </Button>
                </div>
                {/* Proportional timeline lane. */}
                <div className="relative h-9 rounded-sm border border-border/60 bg-black/20">
                  {track.keyframes.map((kf) => {
                    const pct = draft.durationTicks > 0 ? Math.min(100, (kf.tick / draft.durationTicks) * 100) : 0;
                    const isSel = selected?.kfId === kf.id;
                    return (
                      <button
                        key={kf.id}
                        type="button"
                        onClick={() => setSelected({ trackId: track.id, kfId: kf.id })}
                        title={`tick ${kf.tick}`}
                        style={{ left: `${pct}%` }}
                        className={`absolute top-1 h-7 w-7 -translate-x-1/2 rounded-sm border text-[10px] ${isSel ? 'border-primary bg-primary/30 text-primary' : 'border-border bg-card text-foreground/60'}`}
                      >
                        {kf.tick}
                      </button>
                    );
                  })}
                  {track.keyframes.length === 0 && (
                    <span className="absolute inset-0 flex items-center justify-center text-xs text-foreground/30">no keyframes</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="glass-panel h-fit rounded-lg border p-4">
          {!selectedKf || !selectedTrack ? (
            <p className="text-sm text-foreground/40">Select a keyframe to edit it.</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground/60">{selectedTrack.kind} keyframe</h3>
                <Button type="button" variant="ghost" size="sm" onClick={() => removeKeyframe(selectedTrack.id, selectedKf.id)}>Remove</Button>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wide text-foreground/50">Tick</Label>
                <Input type="number" value={selectedKf.tick} onChange={(e) => updateKeyframe(selectedTrack.id, selectedKf.id, { tick: parseInt(e.target.value, 10) || 0 })} />
              </div>
              <KeyframeFields
                kind={selectedTrack.kind}
                data={selectedKf.data}
                onChange={(data) => updateKeyframe(selectedTrack.id, selectedKf.id, { data })}
              />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function KeyframeFields({ kind, data, onChange }: { kind: CinematicTrackKind; data: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void }) {
  const setField = (k: string, v: unknown) => onChange({ ...data, [k]: v });
  const numberField = (key: string, label: string) => (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-foreground/50">{label}</Label>
      <Input type="number" step="0.1" value={num(data, key)} onChange={(e) => setField(key, parseFloat(e.target.value) || 0)} />
    </div>
  );

  if (kind === 'camera') {
    return (
      <div className="grid grid-cols-3 gap-2">
        {numberField('x', 'X')}{numberField('y', 'Y')}{numberField('z', 'Z')}
        {numberField('yaw', 'Yaw')}{numberField('pitch', 'Pitch')}
      </div>
    );
  }
  if (kind === 'subtitle') {
    return (
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wide text-foreground/50">Text</Label>
        <Textarea value={str(data, 'text')} onChange={(e) => setField('text', e.target.value)} rows={3} />
        {numberField('fadeTicks', 'Fade ticks')}
      </div>
    );
  }
  if (kind === 'sound') {
    return (
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wide text-foreground/50">Sound key</Label>
        <Input value={str(data, 'key')} onChange={(e) => setField('key', e.target.value)} />
        <div className="grid grid-cols-2 gap-2">{numberField('volume', 'Volume')}{numberField('pitch', 'Pitch')}</div>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wide text-foreground/50">Event key</Label>
      <Input value={str(data, 'eventKey')} onChange={(e) => setField('eventKey', e.target.value)} />
    </div>
  );
}
