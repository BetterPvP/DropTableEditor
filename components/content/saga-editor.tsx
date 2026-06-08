'use client';

import { GraphContentEditor } from '@/components/graph/graph-content-editor';
import { PrimitiveListEditor } from '@/components/primitives/primitive-list-editor';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { type GraphConfig, type GraphDraft } from '@/lib/graph/types';
import type { PrimitiveInstance } from '@/lib/primitives/types';
import type { EditorManifest } from '@/lib/content/manifest';

const str = (data: Record<string, unknown>, key: string, fallback = '') =>
  typeof data[key] === 'string' ? (data[key] as string) : fallback;
const list = (data: Record<string, unknown>, key: string): PrimitiveInstance[] =>
  Array.isArray(data[key]) ? (data[key] as PrimitiveInstance[]) : [];

const sagaConfig: GraphConfig = {
  palette: [{ kind: 'quest', label: 'Quest' }],
  makeNode: (kind, id, position) => ({ id, kind, position, data: { questId: '', title: '' } }),
  makeEdgeData: () => ({ conditions: [] }),
  renderNodeLabel: (node) => ({
    accent: 'Quest',
    title: str(node.data, 'title') || str(node.data, 'questId') || 'Unassigned',
  }),
  edgeLabel: (edge) => (list(edge.data, 'conditions').length > 0 ? 'gated' : 'unlocks'),

  renderNodeInspector: (node, update, manifest) => {
    const d = node.data;
    const quests = manifest.content.quest;
    const selected = quests.find((q) => q.id === str(d, 'questId'));
    return (
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide text-foreground/50">Quest</Label>
          <Select
            value={str(d, 'questId')}
            onValueChange={(v) => update({ ...d, questId: v, title: quests.find((q) => q.id === v)?.label ?? str(d, 'title') })}
          >
            <SelectTrigger><SelectValue placeholder="Select a quest…" /></SelectTrigger>
            <SelectContent>
              {quests.map((q) => <SelectItem key={q.id} value={q.id}>{q.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {!selected && <p className="text-xs text-amber-400/80">No quest selected — won&apos;t publish.</p>}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide text-foreground/50">Display title (override)</Label>
          <Input value={str(d, 'title')} onChange={(e) => update({ ...d, title: e.target.value })} />
        </div>
      </div>
    );
  },

  renderEdgeInspector: (edge, update, manifest) => (
    <div className="space-y-4">
      <p className="text-xs text-foreground/50">
        A → B means completing A unlocks B. Add conditions to gate the unlock further.
      </p>
      <PrimitiveListEditor
        title="Unlock conditions"
        category="condition"
        value={list(edge.data, 'conditions')}
        onChange={(conditions) => update({ ...edge.data, conditions })}
        manifest={manifest}
      />
    </div>
  ),

  renderMetaInspector: (draft, update) => (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-wide text-foreground/50">Storyline name</Label>
        <Input value={draft.name} onChange={(e) => update({ name: e.target.value } as Partial<GraphDraft>)} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-wide text-foreground/50">Description</Label>
        <Textarea
          value={(draft.description as string) ?? ''}
          onChange={(e) => update({ description: e.target.value } as Partial<GraphDraft>)}
          rows={3}
        />
      </div>
      <p className="text-xs text-foreground/40">Add quest nodes and connect them to express dependencies.</p>
    </div>
  ),
};

export function SagaEditor(props: {
  id: string;
  initialRevision: number;
  initialDraft: GraphDraft;
  manifest: EditorManifest;
}) {
  return (
    <GraphContentEditor
      id={props.id}
      type="saga"
      slug="sagas"
      backLabel="Storylines"
      initialRevision={props.initialRevision}
      initialDraft={props.initialDraft}
      manifest={props.manifest}
      config={sagaConfig}
    />
  );
}
