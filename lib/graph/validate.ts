import type { GraphNode, GraphEdge } from './types';

/**
 * Lightweight structural lints for a graph. Surfaced live in the editor so
 * writers catch disconnected nodes, missing entry points, dangling edges, and
 * (for DAG-shaped content) accidental cycles before publishing.
 */
export function validateGraph(
  nodes: GraphNode[],
  edges: GraphEdge[],
  opts: { allowCycles?: boolean } = {},
): string[] {
  const warnings: string[] = [];
  if (nodes.length === 0) return warnings;

  const ids = new Set(nodes.map((n) => n.id));
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, number>();
  for (const n of nodes) {
    incoming.set(n.id, 0);
    outgoing.set(n.id, 0);
  }
  for (const e of edges) {
    if (outgoing.has(e.source)) outgoing.set(e.source, (outgoing.get(e.source) ?? 0) + 1);
    if (incoming.has(e.target)) incoming.set(e.target, (incoming.get(e.target) ?? 0) + 1);
  }

  if (nodes.length > 1) {
    const orphans = nodes.filter((n) => (incoming.get(n.id) ?? 0) === 0 && (outgoing.get(n.id) ?? 0) === 0);
    if (orphans.length > 0) warnings.push(`${orphans.length} disconnected node(s).`);
  }

  const roots = nodes.filter((n) => (incoming.get(n.id) ?? 0) === 0);
  if (roots.length === 0) warnings.push('No start node — every node has an incoming edge.');

  const dangling = edges.filter((e) => !ids.has(e.source) || !ids.has(e.target));
  if (dangling.length > 0) warnings.push(`${dangling.length} edge(s) reference missing nodes.`);

  if (!opts.allowCycles && hasCycle(nodes, edges)) {
    warnings.push('Contains a cycle — this content is expected to be acyclic.');
  }

  return warnings;
}

function hasCycle(nodes: GraphNode[], edges: GraphEdge[]): boolean {
  const adjacency = new Map<string, string[]>();
  for (const n of nodes) adjacency.set(n.id, []);
  for (const e of edges) adjacency.get(e.source)?.push(e.target);

  const WHITE = 0, GREY = 1, BLACK = 2;
  const color = new Map<string, number>(nodes.map((n) => [n.id, WHITE]));

  const visit = (id: string): boolean => {
    color.set(id, GREY);
    for (const next of adjacency.get(id) ?? []) {
      const c = color.get(next) ?? WHITE;
      if (c === GREY) return true;
      if (c === WHITE && visit(next)) return true;
    }
    color.set(id, BLACK);
    return false;
  };

  for (const n of nodes) {
    if ((color.get(n.id) ?? WHITE) === WHITE && visit(n.id)) return true;
  }
  return false;
}
