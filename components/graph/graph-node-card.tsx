'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { NodeLabel } from '@/lib/graph/types';

/** Single custom node renderer used for every graph kind. */
export function GraphNodeCard({ data, selected }: NodeProps) {
  const label = data.label as NodeLabel;
  return (
    <div
      className={[
        'min-w-[160px] max-w-[240px] rounded-md border bg-card px-3 py-2 shadow-sm transition-colors',
        selected ? 'border-primary ring-1 ring-primary' : 'border-border',
      ].join(' ')}
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !bg-primary" />
      <div className="flex flex-col gap-0.5">
        {label?.accent && (
          <span className="text-[10px] font-semibold uppercase tracking-wider text-primary/80">{label.accent}</span>
        )}
        <span className="truncate text-sm font-medium text-foreground">{label?.title ?? 'Node'}</span>
        {label?.subtitle && <span className="truncate text-xs text-foreground/50">{label.subtitle}</span>}
      </div>
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !bg-primary" />
    </div>
  );
}
