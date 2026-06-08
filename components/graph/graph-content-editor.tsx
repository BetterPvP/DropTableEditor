'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { GraphCanvas } from './graph-canvas';
import { EditorHeader } from '@/components/editor/editor-header';
import { Button } from '@/components/ui/button';
import { useContentEditor } from '@/lib/editor/use-content-editor';
import { genGraphId, type GraphConfig, type GraphDraft, type GraphNode } from '@/lib/graph/types';
import { validateGraph } from '@/lib/graph/validate';
import type { ContentType } from '@/lib/db/types';
import type { EditorManifest } from '@/lib/content/manifest';

interface GraphContentEditorProps {
  id: string;
  type: ContentType;
  slug: string;
  backLabel: string;
  initialRevision: number;
  initialDraft: GraphDraft;
  manifest: EditorManifest;
  config: GraphConfig;
}

type Selection = { id: string; kind: 'node' | 'edge' } | null;

export function GraphContentEditor({
  id, type, slug, backLabel, initialRevision, initialDraft, manifest, config,
}: GraphContentEditorProps) {
  const editor = useContentEditor<GraphDraft>({
    id, type, slug, initialDraft, initialRevision, fallbackName: initialDraft.name,
  });
  const { draft, setDraft } = editor;
  const [selection, setSelection] = useState<Selection>(null);

  const addNode = (kind: string) => {
    const nodeId = genGraphId(kind);
    const position = { x: 120 + draft.nodes.length * 36, y: 120 + (draft.nodes.length % 6) * 48 };
    const node = config.makeNode(kind, nodeId, position);
    setDraft((d) => ({ ...d, nodes: [...d.nodes, node] }));
    setSelection({ id: nodeId, kind: 'node' });
  };

  const updateNodeData = (nodeId: string, data: Record<string, unknown>) =>
    setDraft((d) => ({ ...d, nodes: d.nodes.map((n) => (n.id === nodeId ? { ...n, data } : n)) }));

  const updateEdgeData = (edgeId: string, data: Record<string, unknown>) =>
    setDraft((d) => ({ ...d, edges: d.edges.map((e) => (e.id === edgeId ? { ...e, data } : e)) }));

  const selectedNode: GraphNode | undefined =
    selection?.kind === 'node' ? draft.nodes.find((n) => n.id === selection.id) : undefined;
  const selectedEdge = selection?.kind === 'edge' ? draft.edges.find((e) => e.id === selection.id) : undefined;

  const lints = validateGraph(draft.nodes, draft.edges, { allowCycles: config.allowCycles });

  return (
    <div className="space-y-4">
      <EditorHeader
        title={draft.name || 'Untitled'}
        contentId={id}
        backHref={`/${slug}`}
        backLabel={backLabel}
        status={editor.status}
        dirty={editor.dirty}
        isPublishing={editor.isPublishing}
        isDeleting={editor.isDeleting}
        error={editor.error}
        notice={editor.notice}
        draft={draft}
        exportName={draft.name || type}
        onSave={() => editor.saveNow()}
        onPublish={editor.publish}
        onDelete={editor.remove}
        onImport={(parsed) => {
          if (parsed && typeof parsed === 'object' && Array.isArray((parsed as GraphDraft).nodes)) {
            setDraft(parsed as GraphDraft);
          }
        }}
      />

      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card/60 px-4 py-2">
        <span className="text-xs uppercase tracking-wide text-foreground/50">Add node:</span>
        {config.palette.map((item) => (
          <Button key={item.kind} type="button" variant="outline" size="sm" className="gap-1" onClick={() => addNode(item.kind)}>
            <Plus className="h-3 w-3" /> {item.label}
          </Button>
        ))}
      </div>

      {lints.length > 0 && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-300">
          <span className="font-medium">Lints:</span> {lints.join(' ')}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <GraphCanvas
          nodes={draft.nodes}
          edges={draft.edges}
          config={config}
          selectedId={selection?.id ?? null}
          onNodesChange={(nodes) => setDraft((d) => ({ ...d, nodes }))}
          onEdgesChange={(edges) => setDraft((d) => ({ ...d, edges }))}
          onConnect={(source, target) =>
            setDraft((d) => ({
              ...d,
              edges: [...d.edges, { id: genGraphId('e'), source, target, data: config.makeEdgeData() }],
            }))
          }
          onSelect={(id, kind) => setSelection(id && kind ? { id, kind } : null)}
        />

        <aside className="glass-panel h-[70vh] overflow-y-auto rounded-lg border p-4">
          {selectedNode && (
            <>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-foreground/60">Node</h3>
              {config.renderNodeInspector(selectedNode, (data) => updateNodeData(selectedNode.id, data), manifest)}
            </>
          )}
          {selectedEdge && config.renderEdgeInspector && (
            <>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-foreground/60">Connection</h3>
              {config.renderEdgeInspector(selectedEdge, (data) => updateEdgeData(selectedEdge.id, data), manifest)}
            </>
          )}
          {!selectedNode && !selectedEdge && config.renderMetaInspector && (
            config.renderMetaInspector(draft, (patch) => setDraft((d) => ({ ...d, ...patch })), manifest)
          )}
          {!selectedNode && !selectedEdge && !config.renderMetaInspector && (
            <p className="text-sm text-foreground/40">Select a node or connection to edit it.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
