'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PrimitiveForm } from './primitive-form';
import { primitivesByCategory, primitiveById, defaultParams } from '@/lib/primitives/registry';
import type { PrimitiveCategory, PrimitiveInstance } from '@/lib/primitives/types';
import type { EditorManifest } from '@/lib/content/manifest';

function genId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `p-${Math.random().toString(36).slice(2)}`;
}

interface PrimitiveListEditorProps {
  title: string;
  category: PrimitiveCategory;
  value: PrimitiveInstance[];
  onChange: (next: PrimitiveInstance[]) => void;
  manifest: EditorManifest;
}

export function PrimitiveListEditor({ title, category, value, onChange, manifest }: PrimitiveListEditorProps) {
  const descriptors = primitivesByCategory(category);

  const add = (descriptorId: string) => {
    const descriptor = primitiveById(descriptorId);
    if (!descriptor) return;
    onChange([...value, { id: genId(), type: descriptorId, params: defaultParams(descriptor.params) }]);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground/60">{title}</h3>
        <Select value="" onValueChange={add}>
          <SelectTrigger className="h-8 w-44">
            <span className="flex items-center gap-1 text-xs"><Plus className="h-3 w-3" /> Add</span>
          </SelectTrigger>
          <SelectContent>
            {descriptors.map((d) => <SelectItem key={d.id} value={d.id}>{d.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {value.length === 0 && <p className="text-xs text-foreground/40">None.</p>}

      <div className="space-y-2">
        {value.map((instance, index) => {
          const descriptor = primitiveById(instance.type);
          return (
            <div key={instance.id} className="rounded-md border bg-muted/30 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium">{descriptor?.label ?? instance.type}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onChange(value.filter((_, i) => i !== index))}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              {descriptor && (
                <PrimitiveForm
                  descriptor={descriptor}
                  params={instance.params}
                  onChange={(params) => onChange(value.map((p, i) => (i === index ? { ...p, params } : p)))}
                  manifest={manifest}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
