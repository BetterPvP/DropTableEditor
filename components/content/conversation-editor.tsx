'use client';

import { GraphContentEditor } from '@/components/graph/graph-content-editor';
import { PrimitiveListEditor } from '@/components/primitives/primitive-list-editor';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { genGraphId, type GraphConfig, type GraphDraft, type GraphNode } from '@/lib/graph/types';
import type { PrimitiveInstance } from '@/lib/primitives/types';
import type { EditorManifest } from '@/lib/content/manifest';

const FONTS = ['default', 'small_caps', 'font_3d', 'sprite', 'menu'];

const str = (data: Record<string, unknown>, key: string, fallback = '') =>
  typeof data[key] === 'string' ? (data[key] as string) : fallback;
const num = (data: Record<string, unknown>, key: string, fallback = 0) =>
  typeof data[key] === 'number' ? (data[key] as number) : fallback;
const list = (data: Record<string, unknown>, key: string): PrimitiveInstance[] =>
  Array.isArray(data[key]) ? (data[key] as PrimitiveInstance[]) : [];

/** Mimics the in-game BossBarOverlay dialogue panel for a quick visual check. */
function DialoguePreview({ speaker, body, options }: { speaker: string; body: string; options: string[] }) {
  return (
    <div className="rounded-md border border-primary/30 bg-black/40 p-3 font-mono text-sm">
      <div className="mb-1 text-primary/90">{speaker || 'Speaker'}</div>
      <div className="mb-2 whitespace-pre-wrap text-foreground/90">{body || '…'}</div>
      <div className="space-y-0.5">
        {options.length === 0 && <div className="text-foreground/40">▸ (no responses)</div>}
        {options.map((o, i) => (
          <div key={i} className={i === 0 ? 'text-amber-300' : 'text-foreground/60'}>
            {i === 0 ? '▶' : '▸'} {o || 'Continue'}
          </div>
        ))}
      </div>
    </div>
  );
}

const conversationConfig: GraphConfig = {
  palette: [{ kind: 'dialogue', label: 'Dialogue' }],
  allowCycles: true, // dialogue may loop back

  makeNode: (kind, id, position) => ({
    id, kind, position,
    data: { speaker: '', body: '', font: 'default', typewriterCps: 30, voiceLineKey: '', delayTicks: 0 },
  }),
  makeEdgeData: () => ({ label: 'Continue', conditions: [], actions: [] }),
  renderNodeLabel: (node) => ({
    accent: 'Dialogue',
    title: str(node.data, 'speaker', 'Speaker'),
    subtitle: str(node.data, 'body').slice(0, 48),
  }),
  edgeLabel: (edge) => str(edge.data, 'label', 'Continue'),

  renderNodeInspector: (node, update, _manifest) => {
    const d = node.data;
    return (
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide text-foreground/50">Speaker</Label>
          <Input value={str(d, 'speaker')} onChange={(e) => update({ ...d, speaker: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide text-foreground/50">Body</Label>
          <Textarea value={str(d, 'body')} onChange={(e) => update({ ...d, body: e.target.value })} rows={4} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-foreground/50">Font</Label>
            <Select value={str(d, 'font', 'default')} onValueChange={(v) => update({ ...d, font: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FONTS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-foreground/50">Typewriter cps</Label>
            <Input type="number" value={num(d, 'typewriterCps', 30)} onChange={(e) => update({ ...d, typewriterCps: parseInt(e.target.value, 10) || 0 })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-foreground/50">Voice line key</Label>
            <Input value={str(d, 'voiceLineKey')} onChange={(e) => update({ ...d, voiceLineKey: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-foreground/50">Delay (ticks)</Label>
            <Input type="number" value={num(d, 'delayTicks', 0)} onChange={(e) => update({ ...d, delayTicks: parseInt(e.target.value, 10) || 0 })} />
          </div>
        </div>
        <DialoguePreview speaker={str(d, 'speaker')} body={str(d, 'body')} options={[]} />
      </div>
    );
  },

  renderEdgeInspector: (edge, update, manifest) => {
    const d = edge.data;
    return (
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide text-foreground/50">Response label</Label>
          <Input value={str(d, 'label', 'Continue')} onChange={(e) => update({ ...d, label: e.target.value })} />
        </div>
        <PrimitiveListEditor
          title="Conditions (guard)"
          category="condition"
          value={list(d, 'conditions')}
          onChange={(conditions) => update({ ...d, conditions })}
          manifest={manifest}
        />
        <PrimitiveListEditor
          title="Actions on choose"
          category="action"
          value={list(d, 'actions')}
          onChange={(actions) => update({ ...d, actions })}
          manifest={manifest}
        />
      </div>
    );
  },

  renderMetaInspector: (draft, update) => {
    const nodes = draft.nodes as GraphNode[];
    return (
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide text-foreground/50">Conversation name</Label>
          <Input value={draft.name} onChange={(e) => update({ name: e.target.value } as Partial<GraphDraft>)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide text-foreground/50">Start node</Label>
          <Select
            value={(draft.startNodeId as string) ?? ''}
            onValueChange={(v) => update({ startNodeId: v } as Partial<GraphDraft>)}
          >
            <SelectTrigger><SelectValue placeholder="First dialogue" /></SelectTrigger>
            <SelectContent>
              {nodes.map((n) => (
                <SelectItem key={n.id} value={n.id}>{str(n.data, 'speaker', n.id)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-foreground/40">
          Drag from a node&apos;s right handle to another node to add a response. Select a node or connection to edit it.
        </p>
      </div>
    );
  },
};

export function ConversationEditor(props: {
  id: string;
  initialRevision: number;
  initialDraft: GraphDraft;
  manifest: EditorManifest;
}) {
  return (
    <GraphContentEditor
      id={props.id}
      type="conversation"
      slug="conversations"
      backLabel="Conversations"
      initialRevision={props.initialRevision}
      initialDraft={props.initialDraft}
      manifest={props.manifest}
      config={conversationConfig}
    />
  );
}
