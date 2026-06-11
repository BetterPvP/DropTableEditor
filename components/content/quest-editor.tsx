'use client';

import { GraphContentEditor } from '@/components/graph/graph-content-editor';
import { PrimitiveListEditor } from '@/components/primitives/primitive-list-editor';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { type GraphConfig, type GraphDraft } from '@/lib/graph/types';
import { questTypes, questScopes } from '@/lib/content/quest/schema';
import type { PrimitiveInstance } from '@/lib/primitives/types';
import type { EditorManifest } from '@/lib/content/manifest';

const str = (data: Record<string, unknown>, key: string, fallback = '') =>
  typeof data[key] === 'string' ? (data[key] as string) : fallback;
const list = (data: Record<string, unknown>, key: string): PrimitiveInstance[] =>
  Array.isArray(data[key]) ? (data[key] as PrimitiveInstance[]) : [];

const questConfig: GraphConfig = {
  palette: [{ kind: 'stage', label: 'Stage' }],
  makeNode: (kind, id, position) => ({ id, kind, position, data: { title: 'New stage', objectives: [], actions: [] } }),
  makeEdgeData: () => ({ conditions: [] }),
  renderNodeLabel: (node) => ({
    accent: 'Stage',
    title: str(node.data, 'title', 'Stage'),
    subtitle: `${list(node.data, 'objectives').length} objective(s)`,
  }),
  edgeLabel: (edge) => (list(edge.data, 'conditions').length > 0 ? 'gated' : 'then'),

  renderNodeInspector: (node, update, manifest) => {
    const d = node.data;
    return (
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide text-foreground/50">Stage title</Label>
          <Input value={str(d, 'title')} onChange={(e) => update({ ...d, title: e.target.value })} />
        </div>
        <PrimitiveListEditor
          title="Objectives (triggers)"
          category="trigger"
          value={list(d, 'objectives')}
          onChange={(objectives) => update({ ...d, objectives })}
          manifest={manifest}
        />
        <PrimitiveListEditor
          title="On complete (actions)"
          category="action"
          value={list(d, 'actions')}
          onChange={(actions) => update({ ...d, actions })}
          manifest={manifest}
        />
      </div>
    );
  },

  renderEdgeInspector: (edge, update, manifest) => (
    <PrimitiveListEditor
      title="Transition conditions"
      category="condition"
      value={list(edge.data, 'conditions')}
      onChange={(conditions) => update({ ...edge.data, conditions })}
      manifest={manifest}
    />
  ),

  renderMetaInspector: (draft, update, manifest) => {
    const requirements = (draft.requirements as PrimitiveInstance[]) ?? [];
    const rewards = (draft.rewards as PrimitiveInstance[]) ?? [];
    return (
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide text-foreground/50">Quest name</Label>
          <Input value={draft.name} onChange={(e) => update({ name: e.target.value } as Partial<GraphDraft>)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-foreground/50">Type</Label>
            <Select value={(draft.questType as string) ?? 'side'} onValueChange={(v) => update({ questType: v } as Partial<GraphDraft>)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{questTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-foreground/50">Scope</Label>
            <Select value={(draft.scope as string) ?? 'solo'} onValueChange={(v) => update({ scope: v } as Partial<GraphDraft>)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{questScopes.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary"
            checked={(draft.repeatable as boolean) ?? false}
            onChange={(e) => update({ repeatable: e.target.checked } as Partial<GraphDraft>)}
          />
          <span>Repeatable</span>
          <span className="text-xs text-foreground/40">— can be completed more than once</span>
        </label>
        <PrimitiveListEditor
          title="Requirements (to start)"
          category="requirement"
          value={requirements}
          onChange={(v) => update({ requirements: v } as Partial<GraphDraft>)}
          manifest={manifest}
        />
        <PrimitiveListEditor
          title="Rewards (on complete)"
          category="reward"
          value={rewards}
          onChange={(v) => update({ rewards: v } as Partial<GraphDraft>)}
          manifest={manifest}
        />
        <p className="text-xs text-foreground/40">Add stage nodes and connect them to sequence the quest.</p>
      </div>
    );
  },
};

export function QuestEditor(props: {
  id: string;
  initialRevision: number;
  initialDraft: GraphDraft;
  manifest: EditorManifest;
}) {
  return (
    <GraphContentEditor
      id={props.id}
      type="quest"
      slug="quests"
      backLabel="Quests"
      initialRevision={props.initialRevision}
      initialDraft={props.initialDraft}
      manifest={props.manifest}
      config={questConfig}
    />
  );
}
