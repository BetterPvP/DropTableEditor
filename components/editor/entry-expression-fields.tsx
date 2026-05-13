'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { EntryWeight, getPreviewWeight } from '@/lib/loot-tables/types';

interface WeightFieldProps {
  weight: EntryWeight;
  onChange: (weight: EntryWeight) => void;
  onBlur?: () => void;
  /** Helper caption shown beneath the field. */
  helperText?: string;
}

/**
 * Edits an entry weight. Toggle switches between a numeric constant and a JEXL expression
 * whose result is coerced to a non-negative integer at roll time.
 *
 * In expression mode the field spans the full 4-column entry grid; in constant mode it
 * fits within a single column to sit alongside yield/amount/replacement.
 */
export function WeightField({ weight, onChange, onBlur, helperText }: WeightFieldProps) {
  const isExpression = typeof weight === 'object' && weight.type === 'EXPRESSION';

  if (isExpression) {
    return (
      <div className="space-y-2 sm:col-span-4">
        <div className="flex items-center justify-between">
          <Label>Weight</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto px-2 py-1 text-sky-400 hover:text-sky-300 hover:bg-sky-500/10"
            onClick={() => onChange(weight.preview || 1)}
          >
            Use constant
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr] items-start">
          <div className="space-y-1">
            <Label className="text-xs">Expression</Label>
            <Textarea
              rows={2}
              value={weight.expression}
              placeholder="e.g. dungeon_score >= 50 ? 10 : 2 — use fn:clamp/min/max/round/abs/floor/ceil"
              onChange={(e) => onChange({ ...weight, expression: e.target.value })}
              onBlur={onBlur}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Fallback</Label>
            <Input
              type="number"
              min={0}
              value={weight.fallback}
              onChange={(e) => onChange({ ...weight, fallback: Number(e.target.value) || 0 })}
              onBlur={onBlur}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Preview</Label>
            <Input
              type="number"
              min={0}
              value={weight.preview}
              onChange={(e) => onChange({ ...weight, preview: Number(e.target.value) || 0 })}
              onBlur={onBlur}
            />
          </div>
        </div>
        <p className="text-xs text-foreground/50">
          Fallback is used when the expression fails. Preview drives menu odds & probabilities in the editor.
        </p>
      </div>
    );
  }

  const numeric = getPreviewWeight(weight);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label>Weight</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto px-2 py-1 text-sky-400 hover:text-sky-300 hover:bg-sky-500/10"
          onClick={() =>
            onChange({ type: 'EXPRESSION', expression: '', fallback: numeric, preview: numeric })
          }
        >
          Use expression
        </Button>
      </div>
      <Input
        type="number"
        min={0}
        value={numeric}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        onBlur={onBlur}
      />
      {helperText ? <p className="text-xs text-foreground/50">{helperText}</p> : null}
    </div>
  );
}

interface ConditionFieldProps {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  onBlur?: () => void;
}

/**
 * Optional JEXL condition. Collapsed to a button by default; clicking expands the editor.
 * Empty value clears the field entirely so the entry always drops.
 */
export function ConditionField({ value, onChange, onBlur }: ConditionFieldProps) {
  const hasValue = value !== undefined && value.length > 0;
  const [expanded, setExpanded] = useState(hasValue);

  if (!expanded) {
    return (
      <div className="sm:col-span-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto px-2 py-1 text-sky-400 hover:text-sky-300 hover:bg-sky-500/10"
          onClick={() => setExpanded(true)}
        >
          <Plus className="mr-1 h-4 w-4" />
          Condition
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-1 sm:col-span-4">
      <div className="flex items-center justify-between">
        <Label>Condition</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto px-2 py-1 text-red-400 hover:text-red-300 hover:bg-red-500/10"
          onClick={() => {
            onChange(undefined);
            setExpanded(false);
          }}
        >
          <X className="mr-1 h-4 w-4" />
          Remove
        </Button>
      </div>
      <Textarea
        rows={2}
        value={value ?? ''}
        placeholder="e.g. slayer_standing == 1 && dungeon_score > 50"
        onChange={(e) => {
          const next = e.target.value.trim();
          onChange(next.length === 0 ? undefined : next);
        }}
        onBlur={onBlur}
      />
      <p className="text-xs text-foreground/50">
        JEXL expression. Entry only drops when truthy. Available variables come from the table's inputs plus reserved names (roll_index, bundle_size, history_size, source).
      </p>
    </div>
  );
}
