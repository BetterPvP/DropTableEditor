import type { ReactNode } from 'react';
import type { ContentType } from '@/lib/db/types';
import type { EditorManifest } from '@/lib/content/manifest';

/**
 * Graph data model shared by saga / quest / conversation editors. Maps almost
 * 1:1 onto React Flow's node/edge shape, so persistence ↔ canvas is trivial.
 */
export interface GraphNode {
  id: string;
  /** Node kind within this graph (e.g. 'dialogue', 'stage', 'quest'). */
  kind: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  data: Record<string, unknown>;
}

export interface GraphDraft {
  name: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Type-specific top-level fields (quest metadata, etc.). */
  [key: string]: unknown;
}

export interface NodeLabel {
  title: string;
  subtitle?: string;
  accent?: string;
}

/** Palette entry: a kind of node the user can add. */
export interface NodePaletteItem {
  kind: string;
  label: string;
}

export interface GraphConfig<TDraft extends GraphDraft = GraphDraft> {
  palette: NodePaletteItem[];
  /** When false (default), the editor lints cycles as warnings (DAG-shaped). */
  allowCycles?: boolean;
  makeNode: (kind: string, id: string, position: { x: number; y: number }) => GraphNode;
  makeEdgeData: () => Record<string, unknown>;
  renderNodeLabel: (node: GraphNode) => NodeLabel;
  edgeLabel?: (edge: GraphEdge) => string | undefined;
  renderNodeInspector: (
    node: GraphNode,
    update: (data: Record<string, unknown>) => void,
    manifest: EditorManifest,
  ) => ReactNode;
  renderEdgeInspector?: (
    edge: GraphEdge,
    update: (data: Record<string, unknown>) => void,
    manifest: EditorManifest,
  ) => ReactNode;
  renderMetaInspector?: (
    draft: TDraft,
    update: (patch: Partial<TDraft>) => void,
    manifest: EditorManifest,
  ) => ReactNode;
}

export function genGraphId(prefix: string): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? `${prefix}-${crypto.randomUUID().slice(0, 8)}`
    : `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export type { ContentType };
