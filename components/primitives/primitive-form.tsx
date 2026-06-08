'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { EditorManifest, RefOption } from '@/lib/content/manifest';
import type { ParamSpec, PrimitiveDescriptor } from '@/lib/primitives/types';

interface PrimitiveFormProps {
  descriptor: PrimitiveDescriptor;
  params: Record<string, unknown>;
  onChange: (params: Record<string, unknown>) => void;
  manifest: EditorManifest;
}

function refOptions(spec: ParamSpec, manifest: EditorManifest): RefOption[] {
  switch (spec.type) {
    case 'item_ref': return manifest.items;
    case 'zone_ref': return manifest.zones;
    case 'npc_ref': return manifest.npcs;
    case 'profession_ref': return manifest.professions;
    case 'content_ref': return spec.contentType ? manifest.content[spec.contentType] : [];
    default: return [];
  }
}

export function PrimitiveForm({ descriptor, params, onChange, manifest }: PrimitiveFormProps) {
  const set = (key: string, value: unknown) => onChange({ ...params, [key]: value });

  return (
    <div className="space-y-3">
      {Object.entries(descriptor.params).map(([key, spec]) => {
        const label = spec.label ?? key;
        const value = params[key];
        const isRef = ['item_ref', 'zone_ref', 'npc_ref', 'profession_ref', 'content_ref'].includes(spec.type);

        return (
          <div key={key} className="space-y-1.5">
            <Label htmlFor={`${descriptor.id}-${key}`} className="text-xs uppercase tracking-wide text-foreground/50">
              {label}{spec.required ? ' *' : ''}
            </Label>

            {spec.type === 'text' && (
              <Textarea
                id={`${descriptor.id}-${key}`}
                value={String(value ?? '')}
                onChange={(e) => set(key, e.target.value)}
              />
            )}

            {(spec.type === 'string' || spec.type === 'jexl') && (
              <Input
                id={`${descriptor.id}-${key}`}
                value={String(value ?? '')}
                placeholder={spec.type === 'jexl' ? 'JEXL expression' : undefined}
                onChange={(e) => set(key, e.target.value)}
              />
            )}

            {(spec.type === 'int' || spec.type === 'float') && (
              <Input
                id={`${descriptor.id}-${key}`}
                type="number"
                step={spec.type === 'float' ? '0.1' : '1'}
                value={Number(value ?? 0)}
                onChange={(e) => set(key, spec.type === 'float' ? parseFloat(e.target.value) : parseInt(e.target.value, 10) || 0)}
              />
            )}

            {spec.type === 'boolean' && (
              <label className="flex items-center gap-2 text-sm text-foreground/80">
                <input
                  type="checkbox"
                  checked={Boolean(value)}
                  onChange={(e) => set(key, e.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
                Enabled
              </label>
            )}

            {spec.type === 'enum' && (
              <Select value={String(value ?? '')} onValueChange={(v) => set(key, v)}>
                <SelectTrigger id={`${descriptor.id}-${key}`}><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {(spec.options ?? []).map((opt) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                </SelectContent>
              </Select>
            )}

            {isRef && (
              <Select value={String(value ?? '')} onValueChange={(v) => set(key, v)}>
                <SelectTrigger id={`${descriptor.id}-${key}`}><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {refOptions(spec, manifest).map((opt) => (
                    <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {spec.help && <p className="text-xs text-foreground/40">{spec.help}</p>}
          </div>
        );
      })}
      {Object.keys(descriptor.params).length === 0 && (
        <p className="text-xs text-foreground/40">No parameters.</p>
      )}
    </div>
  );
}
