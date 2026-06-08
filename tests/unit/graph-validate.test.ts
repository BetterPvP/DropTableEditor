import { describe, expect, it } from 'vitest';
import { validateGraph } from '@/lib/graph/validate';
import type { GraphNode, GraphEdge } from '@/lib/graph/types';

const node = (id: string): GraphNode => ({ id, kind: 'n', position: { x: 0, y: 0 }, data: {} });
const edge = (source: string, target: string): GraphEdge => ({ id: `${source}-${target}`, source, target, data: {} });

describe('validateGraph', () => {
  it('passes a clean linear DAG', () => {
    const warnings = validateGraph([node('a'), node('b')], [edge('a', 'b')]);
    expect(warnings).toEqual([]);
  });

  it('flags disconnected nodes', () => {
    const warnings = validateGraph([node('a'), node('b'), node('c')], [edge('a', 'b')]);
    expect(warnings.some((w) => w.includes('disconnected'))).toBe(true);
  });

  it('flags dangling edges to missing nodes', () => {
    const warnings = validateGraph([node('a')], [edge('a', 'ghost')]);
    expect(warnings.some((w) => w.includes('missing nodes'))).toBe(true);
  });

  it('detects cycles when not allowed, but tolerates them when allowed', () => {
    const nodes = [node('a'), node('b')];
    const edges = [edge('a', 'b'), edge('b', 'a')];
    expect(validateGraph(nodes, edges).some((w) => w.includes('cycle'))).toBe(true);
    expect(validateGraph(nodes, edges, { allowCycles: true }).some((w) => w.includes('cycle'))).toBe(false);
  });

  it('treats an empty graph as fine', () => {
    expect(validateGraph([], [])).toEqual([]);
  });
});
