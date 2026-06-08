'use client';

import { useMemo } from 'react';
import {
  ReactFlow, Background, Controls, MiniMap,
  type Node, type Edge, type NodeChange, type EdgeChange, type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { GraphNodeCard } from './graph-node-card';
import type { GraphNode, GraphEdge, GraphConfig } from '@/lib/graph/types';

const nodeTypes = { card: GraphNodeCard };

interface GraphCanvasProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  config: Pick<GraphConfig, 'renderNodeLabel' | 'edgeLabel'>;
  selectedId: string | null;
  onNodesChange: (nodes: GraphNode[]) => void;
  onEdgesChange: (edges: GraphEdge[]) => void;
  onConnect: (source: string, target: string) => void;
  onSelect: (id: string | null, kind: 'node' | 'edge' | null) => void;
}

export function GraphCanvas({
  nodes, edges, config, selectedId, onNodesChange, onEdgesChange, onConnect, onSelect,
}: GraphCanvasProps) {
  const rfNodes: Node[] = useMemo(
    () => nodes.map((n) => ({
      id: n.id,
      type: 'card',
      position: n.position,
      data: { label: config.renderNodeLabel(n) },
      selected: selectedId === n.id,
    })),
    [nodes, selectedId, config],
  );

  const rfEdges: Edge[] = useMemo(
    () => edges.map((e) => ({
      id: e.id, source: e.source, target: e.target,
      label: config.edgeLabel?.(e),
      selected: selectedId === e.id,
    })),
    [edges, selectedId, config],
  );

  const handleNodesChange = (changes: NodeChange[]) => {
    let result = nodes;
    for (const c of changes) {
      if (c.type === 'position' && c.position) {
        const pos = c.position;
        result = result.map((n) => (n.id === c.id ? { ...n, position: pos } : n));
      } else if (c.type === 'remove') {
        result = result.filter((n) => n.id !== c.id);
      }
    }
    if (result !== nodes) onNodesChange(result);
  };

  const handleEdgesChange = (changes: EdgeChange[]) => {
    let result = edges;
    for (const c of changes) {
      if (c.type === 'remove') result = result.filter((e) => e.id !== c.id);
    }
    if (result !== edges) onEdgesChange(result);
  };

  return (
    <div className="h-[70vh] w-full overflow-hidden rounded-lg border bg-muted/10">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={(c: Connection) => {
          if (c.source && c.target && c.source !== c.target) onConnect(c.source, c.target);
        }}
        // Selection is driven by explicit clicks (not onSelectionChange, which
        // fires via an effect every commit and loops with controlled state).
        onNodeClick={(_, node) => onSelect(node.id, 'node')}
        onEdgeClick={(_, edge) => onSelect(edge.id, 'edge')}
        onPaneClick={() => onSelect(null, null)}
        fitView
        proOptions={{ hideAttribution: true }}
        colorMode="dark"
      >
        <Background />
        <Controls />
        <MiniMap pannable zoomable className="!bg-card" />
      </ReactFlow>
    </div>
  );
}
