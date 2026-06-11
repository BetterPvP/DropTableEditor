'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, LayoutList, Network, Plus, Trash2 } from 'lucide-react';
import { EditorHeader } from '@/components/editor/editor-header';
import { GraphCanvas } from '@/components/graph/graph-canvas';
import { PrimitiveListEditor } from '@/components/primitives/primitive-list-editor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useContentEditor } from '@/lib/editor/use-content-editor';
import { genGraphId, type GraphDraft, type GraphEdge, type GraphNode } from '@/lib/graph/types';
import type { ResponseDefinition, ResponseOutcome } from '@/lib/content/conversation/schema';
import type { PrimitiveInstance } from '@/lib/primitives/types';
import type { EditorManifest } from '@/lib/content/manifest';

const FONTS = ['default', 'small_caps', 'font_3d', 'sprite', 'menu'];

// Sentinel select values for outcomes that aren't a goto-by-node-id.
const END = '__end__';
const START_CONV = '__start_conversation__';
const START_CINE = '__start_cinematic__';

const str = (d: Record<string, unknown>, k: string, f = '') => (typeof d[k] === 'string' ? (d[k] as string) : f);
const num = (d: Record<string, unknown>, k: string, f = 0) => (typeof d[k] === 'number' ? (d[k] as number) : f);
const list = (d: Record<string, unknown>, k: string): PrimitiveInstance[] => (Array.isArray(d[k]) ? (d[k] as PrimitiveInstance[]) : []);
const responsesOf = (n: GraphNode): ResponseDefinition[] => (Array.isArray(n.data.responses) ? (n.data.responses as ResponseDefinition[]) : []);

// A derived graph edge id carries its provenance: `${sourceNodeId}::${responseId}`.
const edgeId = (nodeId: string, respId: string) => `${nodeId}::${respId}`;
const sourceOfEdge = (id: string) => id.split('::')[0];

/** Collapse an outcome to the single value the "Then" <Select> shows. */
const outcomeToSelect = (o: ResponseOutcome): string => {
  switch (o.kind) {
    case 'goto': return o.target || END;
    case 'start_conversation': return START_CONV;
    case 'start_cinematic': return START_CINE;
    case 'end': return END;
  }
};

/** Build a fresh outcome from a "Then" selection, preserving any existing ref id. */
const selectToOutcome = (value: string, prev: ResponseOutcome): ResponseOutcome => {
  if (value === END) return { kind: 'end' };
  if (value === START_CONV) return { kind: 'start_conversation', conversationId: prev.kind === 'start_conversation' ? prev.conversationId : '' };
  if (value === START_CINE) return { kind: 'start_cinematic', cinematicId: prev.kind === 'start_cinematic' ? prev.cinematicId : '' };
  return { kind: 'goto', target: value };
};

export function ConversationEditor(props: {
  id: string;
  initialRevision: number;
  initialDraft: GraphDraft;
  manifest: EditorManifest;
}) {
  const editor = useContentEditor<GraphDraft>({
    id: props.id, type: 'conversation', slug: 'conversations',
    initialDraft: props.initialDraft, initialRevision: props.initialRevision, fallbackName: props.initialDraft.name,
  });
  const { draft, setDraft } = editor;
  const nodes = draft.nodes;

  const nodeTitle = (n: GraphNode) => str(n.data, 'speaker', 'Speaker') + (str(n.data, 'body') ? ` — “${str(n.data, 'body').slice(0, 28)}…”` : '');

  const addNode = () => {
    const id = genGraphId('d');
    const node: GraphNode = {
      id, kind: 'dialogue', position: { x: nodes.length * 40, y: 100 },
      data: { speaker: '', body: '', font: 'default', typewriterCps: 30, voiceLineKey: '', delayTicks: 0, responses: [] },
    };
    setDraft((d) => ({ ...d, nodes: [...d.nodes, node], startNodeId: d.startNodeId ?? id }));
  };

  const updateNodeData = (id: string, data: Record<string, unknown>) =>
    setDraft((d) => ({ ...d, nodes: d.nodes.map((n) => (n.id === id ? { ...n, data } : n)) }));

  const deleteNode = (id: string) =>
    setDraft((d) => ({
      ...d,
      // Drop the node and rewrite any goto-responses that pointed at it back to "end".
      nodes: d.nodes
        .filter((n) => n.id !== id)
        .map((n) => ({
          ...n,
          data: {
            ...n.data,
            responses: responsesOf(n).map((r) =>
              r.outcome.kind === 'goto' && r.outcome.target === id ? { ...r, outcome: { kind: 'end' as const } } : r,
            ),
          },
        })),
      startNodeId: d.startNodeId === id ? d.nodes.find((n) => n.id !== id)?.id : d.startNodeId,
    }));

  // ── Response operations (live on node.data.responses) ──────────────────────
  const mutateResponses = (nodeId: string, fn: (rs: ResponseDefinition[]) => ResponseDefinition[]) =>
    setDraft((d) => ({
      ...d,
      nodes: d.nodes.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, responses: fn(responsesOf(n)) } } : n)),
    }));

  const addResponse = (nodeId: string) =>
    mutateResponses(nodeId, (rs) => [
      ...rs,
      { id: genGraphId('r'), label: 'Continue', flag: '', conditions: [], actions: [], outcome: { kind: 'end' } },
    ]);

  const updateResponse = (nodeId: string, respId: string, patch: Partial<ResponseDefinition>) =>
    mutateResponses(nodeId, (rs) => rs.map((r) => (r.id === respId ? { ...r, ...patch } : r)));

  const deleteResponse = (nodeId: string, respId: string) =>
    mutateResponses(nodeId, (rs) => rs.filter((r) => r.id !== respId));

  // ── Graph view ─────────────────────────────────────────────────────────────
  const [view, setView] = useState<'cards' | 'graph'>('cards');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  // The canvas is a projection of the response model: only `goto` outcomes have
  // a target node, so only they become edges; terminal outcomes have none.
  const graphEdges = useMemo<GraphEdge[]>(
    () =>
      nodes.flatMap((n) =>
        responsesOf(n)
          .filter((r) => r.outcome.kind === 'goto' && r.outcome.target)
          .map((r) => ({
            id: edgeId(n.id, r.id),
            source: n.id,
            target: (r.outcome as { target: string }).target,
            data: { label: r.label },
          })),
      ),
    [nodes],
  );

  const graphConfig = useMemo(
    () => ({
      renderNodeLabel: (n: GraphNode) => {
        const count = responsesOf(n).length;
        return {
          accent: 'Dialogue',
          title: str(n.data, 'speaker', 'Speaker'),
          subtitle: str(n.data, 'body').slice(0, 48) || `${count} response${count === 1 ? '' : 's'}`,
        };
      },
      edgeLabel: (e: GraphEdge) => str(e.data, 'label', 'Continue'),
    }),
    [],
  );

  // Persist node moves/removals, pruning any goto whose target node is gone.
  const applyNodes = (next: GraphNode[]) =>
    setDraft((d) => {
      const ids = new Set(next.map((n) => n.id));
      const cleaned = next.map((n) => ({
        ...n,
        data: {
          ...n.data,
          responses: responsesOf(n).map((r) =>
            r.outcome.kind === 'goto' && !ids.has(r.outcome.target) ? { ...r, outcome: { kind: 'end' as const } } : r,
          ),
        },
      }));
      const start = typeof d.startNodeId === 'string' && ids.has(d.startNodeId) ? d.startNodeId : next[0]?.id;
      return { ...d, nodes: cleaned, startNodeId: start };
    });

  // Deleting a connection on the canvas removes the response it came from.
  const applyEdges = (next: GraphEdge[]) => {
    const kept = new Set(next.map((e) => e.id));
    setDraft((d) => ({
      ...d,
      nodes: d.nodes.map((n) => ({
        ...n,
        data: {
          ...n.data,
          responses: responsesOf(n).filter((r) => r.outcome.kind !== 'goto' || kept.has(edgeId(n.id, r.id))),
        },
      })),
    }));
  };

  // Dragging a connection creates a goto response on the source node.
  const connect = (source: string, target: string) =>
    mutateResponses(source, (rs) => [
      ...rs,
      { id: genGraphId('r'), label: 'Continue', flag: '', conditions: [], actions: [], outcome: { kind: 'goto', target } },
    ]);

  return (
    <div className="space-y-4">
      <EditorHeader
        title={draft.name || 'Conversation'}
        contentId={props.id}
        backHref="/conversations"
        backLabel="Conversations"
        status={editor.status}
        dirty={editor.dirty}
        isPublishing={editor.isPublishing}
        isDeleting={editor.isDeleting}
        error={editor.error}
        notice={editor.notice}
        draft={draft}
        exportName={draft.name || 'conversation'}
        onSave={() => editor.saveNow()}
        onPublish={editor.publish}
        onDelete={editor.remove}
        onImport={(parsed) => {
          if (parsed && typeof parsed === 'object' && Array.isArray((parsed as GraphDraft).nodes)) setDraft(parsed as GraphDraft);
        }}
      />

      <div className="glass-panel flex flex-wrap items-end gap-4 rounded-lg border p-4">
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide text-foreground/50">Conversation name</Label>
          <Input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} className="w-64" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide text-foreground/50">Starts at</Label>
          <Select value={(draft.startNodeId as string) ?? ''} onValueChange={(v) => setDraft((d) => ({ ...d, startNodeId: v }))}>
            <SelectTrigger className="w-72"><SelectValue placeholder="First dialogue" /></SelectTrigger>
            <SelectContent>
              {nodes.map((n) => <SelectItem key={n.id} value={n.id}>{nodeTitle(n)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button type="button" variant="outline" className="gap-2" onClick={addNode}><Plus className="h-4 w-4" /> Add dialogue</Button>

        <div className="ml-auto inline-flex rounded-md border border-border/60 p-0.5">
          <Button type="button" size="sm" variant={view === 'cards' ? 'default' : 'ghost'} className="gap-1.5" onClick={() => setView('cards')}>
            <LayoutList className="h-4 w-4" /> Cards
          </Button>
          <Button type="button" size="sm" variant={view === 'graph' ? 'default' : 'ghost'} className="gap-1.5" onClick={() => setView('graph')}>
            <Network className="h-4 w-4" /> Graph
          </Button>
        </div>
      </div>

      {nodes.length === 0 && (
        <div className="glass-panel rounded-lg border p-8 text-center text-foreground/50">No dialogue yet. Add one to begin.</div>
      )}

      {view === 'cards' &&
        nodes.map((node) => (
          <DialogueCard
            key={node.id}
            node={node}
            nodes={nodes}
            responses={responsesOf(node)}
            manifest={props.manifest}
            onUpdate={(data) => updateNodeData(node.id, data)}
            onDelete={() => deleteNode(node.id)}
            onAddResponse={() => addResponse(node.id)}
            onUpdateResponse={(respId, patch) => updateResponse(node.id, respId, patch)}
            onDeleteResponse={(respId) => deleteResponse(node.id, respId)}
          />
        ))}

      {view === 'graph' && nodes.length > 0 && (
        <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
          <GraphCanvas
            nodes={nodes}
            edges={graphEdges}
            config={graphConfig}
            selectedId={selectedNodeId}
            onNodesChange={applyNodes}
            onEdgesChange={applyEdges}
            onConnect={connect}
            onSelect={(id, kind) => setSelectedNodeId(id ? (kind === 'edge' ? sourceOfEdge(id) : id) : null)}
          />

          <aside className="glass-panel h-[70vh] overflow-y-auto rounded-lg border p-4">
            {selectedNode ? (
              <DialogueCard
                node={selectedNode}
                nodes={nodes}
                responses={responsesOf(selectedNode)}
                manifest={props.manifest}
                onUpdate={(data) => updateNodeData(selectedNode.id, data)}
                onDelete={() => {
                  deleteNode(selectedNode.id);
                  setSelectedNodeId(null);
                }}
                onAddResponse={() => addResponse(selectedNode.id)}
                onUpdateResponse={(respId, patch) => updateResponse(selectedNode.id, respId, patch)}
                onDeleteResponse={(respId) => deleteResponse(selectedNode.id, respId)}
                bare
              />
            ) : (
              <p className="text-sm text-foreground/40">
                Select a dialogue to edit it. Drag from a node’s right edge to another to add a branching response; delete a
                connection to remove that response.
              </p>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function DialogueCard({ node, nodes, responses, manifest, onUpdate, onDelete, onAddResponse, onUpdateResponse, onDeleteResponse, bare }: {
  node: GraphNode;
  nodes: GraphNode[];
  responses: ResponseDefinition[];
  manifest: EditorManifest;
  onUpdate: (data: Record<string, unknown>) => void;
  onDelete: () => void;
  onAddResponse: () => void;
  onUpdateResponse: (respId: string, patch: Partial<ResponseDefinition>) => void;
  onDeleteResponse: (respId: string) => void;
  /** Drop the panel chrome when embedded in the graph inspector aside. */
  bare?: boolean;
}) {
  const d = node.data;
  return (
    <div className={bare ? '' : 'glass-panel rounded-lg border p-5'}>
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-xs text-foreground/40">{node.id}</span>
        <Button type="button" size="sm" variant="destructive" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide text-foreground/50">Speaker</Label>
          <Input value={str(d, 'speaker')} onChange={(e) => onUpdate({ ...d, speaker: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide text-foreground/50">Font</Label>
          <Select value={str(d, 'font', 'default')} onValueChange={(v) => onUpdate({ ...d, font: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{FONTS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label className="text-xs uppercase tracking-wide text-foreground/50">Body</Label>
          <Textarea value={str(d, 'body')} onChange={(e) => onUpdate({ ...d, body: e.target.value })} rows={3} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide text-foreground/50">Voice line key</Label>
          <Input value={str(d, 'voiceLineKey')} onChange={(e) => onUpdate({ ...d, voiceLineKey: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-foreground/50">Typewriter cps</Label>
            <Input type="number" value={num(d, 'typewriterCps', 30)} onChange={(e) => onUpdate({ ...d, typewriterCps: parseInt(e.target.value, 10) || 0 })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-foreground/50">Delay (ticks)</Label>
            <Input type="number" value={num(d, 'delayTicks', 0)} onChange={(e) => onUpdate({ ...d, delayTicks: parseInt(e.target.value, 10) || 0 })} />
          </div>
        </div>
      </div>

      <div className="mt-4 border-t border-border/50 pt-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold uppercase tracking-wide text-foreground/60">Responses</span>
          <Button type="button" variant="outline" size="sm" className="gap-1" onClick={onAddResponse}><Plus className="h-3 w-3" /> Add response</Button>
        </div>
        {responses.length === 0 && (
          <p className="text-xs text-foreground/40">No responses — the conversation ends after this line. Add a response to continue or branch.</p>
        )}
        <div className="space-y-2">
          {responses.map((resp) => (
            <ResponseRow
              key={resp.id}
              resp={resp}
              nodes={nodes}
              selfId={node.id}
              manifest={manifest}
              onUpdate={(patch) => onUpdateResponse(resp.id, patch)}
              onDelete={() => onDeleteResponse(resp.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ResponseRow({ resp, nodes, selfId, manifest, onUpdate, onDelete }: {
  resp: ResponseDefinition;
  nodes: GraphNode[];
  selfId: string;
  manifest: EditorManifest;
  onUpdate: (patch: Partial<ResponseDefinition>) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const outcome = resp.outcome;
  return (
    <div className="rounded-md border border-border/60 bg-muted/20 p-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 space-y-1.5">
          <Label className="text-xs uppercase tracking-wide text-foreground/50">Option text</Label>
          <Input value={resp.label} onChange={(e) => onUpdate({ label: e.target.value })} placeholder="I'll help." />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide text-foreground/50">Then</Label>
          <Select value={outcomeToSelect(outcome)} onValueChange={(v) => onUpdate({ outcome: selectToOutcome(v, outcome) })}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={END}>End conversation</SelectItem>
              {nodes.map((n) => (
                <SelectItem key={n.id} value={n.id}>
                  {n.id === selfId ? '↻ ' : '→ '}{str(n.data, 'speaker', n.id)}
                </SelectItem>
              ))}
              <SelectItem value={START_CONV}>Start conversation…</SelectItem>
              <SelectItem value={START_CINE}>Start cinematic…</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={() => setOpen((o) => !o)} title="Conditions & actions">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
      </div>

      {outcome.kind === 'start_conversation' && (
        <div className="mt-2 space-y-1.5">
          <Label className="text-xs uppercase tracking-wide text-foreground/50">Conversation to start</Label>
          <Select value={outcome.conversationId || ''} onValueChange={(v) => onUpdate({ outcome: { kind: 'start_conversation', conversationId: v } })}>
            <SelectTrigger className="w-72"><SelectValue placeholder="Pick a conversation" /></SelectTrigger>
            <SelectContent>
              {manifest.content.conversation.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {outcome.kind === 'start_cinematic' && (
        <div className="mt-2 space-y-1.5">
          <Label className="text-xs uppercase tracking-wide text-foreground/50">Cinematic to start</Label>
          <Select value={outcome.cinematicId || ''} onValueChange={(v) => onUpdate({ outcome: { kind: 'start_cinematic', cinematicId: v } })}>
            <SelectTrigger className="w-72"><SelectValue placeholder="Pick a cinematic" /></SelectTrigger>
            <SelectContent>
              {manifest.content.cinematic.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {open && (
        <div className="mt-3 space-y-4 border-t border-border/50 pt-3">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-foreground/50">Remember choice as flag (optional)</Label>
            <Input value={resp.flag} onChange={(e) => onUpdate({ flag: e.target.value })} placeholder="helped_garrick" className="w-72" />
            <p className="text-xs text-foreground/40">Saved per player when chosen; usable later via the “has flag” condition.</p>
          </div>
          <PrimitiveListEditor
            title="Only show if (conditions)"
            category="condition"
            value={list(resp as unknown as Record<string, unknown>, 'conditions')}
            onChange={(conditions) => onUpdate({ conditions })}
            manifest={manifest}
          />
          <PrimitiveListEditor
            title="Do when chosen (actions)"
            category="action"
            value={list(resp as unknown as Record<string, unknown>, 'actions')}
            onChange={(actions) => onUpdate({ actions })}
            manifest={manifest}
          />
        </div>
      )}
    </div>
  );
}
