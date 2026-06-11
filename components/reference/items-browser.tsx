'use client';

import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { GameItem } from '@/lib/db/repositories/manifest';

type MatchMode = 'contains' | 'exact' | 'regex';
type TagMode = 'any' | 'all';

const NO_NAMESPACE = '(none)';

const namespaceOf = (key: string) => (key.includes(':') ? key.slice(0, key.indexOf(':')) : NO_NAMESPACE);

/** A compiled text matcher — regex compiled once per query, not per item. */
type Matcher =
  | { kind: 'empty' }
  | { kind: 'plain'; needle: string; mode: 'contains' | 'exact' }
  | { kind: 'regex'; re: RegExp }
  | { kind: 'error'; message: string };

function buildMatcher(q: string, mode: MatchMode): Matcher {
  if (!q.trim()) return { kind: 'empty' };
  if (mode === 'regex') {
    try {
      return { kind: 'regex', re: new RegExp(q, 'i') };
    } catch (e) {
      return { kind: 'error', message: (e as Error).message };
    }
  }
  return { kind: 'plain', needle: q.toLowerCase(), mode };
}

function fieldMatches(field: string, m: Matcher): boolean {
  switch (m.kind) {
    case 'empty':
      return true;
    case 'error':
      return false;
    case 'regex':
      return m.re.test(field);
    case 'plain': {
      const hay = field.toLowerCase();
      return m.mode === 'exact' ? hay === m.needle : hay.includes(m.needle);
    }
  }
}

export function ItemsBrowser({ items }: { items: GameItem[] }) {
  const [q, setQ] = useState('');
  const [mode, setMode] = useState<MatchMode>('contains');
  const [namespaces, setNamespaces] = useState<Set<string>>(new Set());
  const [tags, setTags] = useState<Set<string>>(new Set());
  const [tagMode, setTagMode] = useState<TagMode>('any');

  // Facets derived once from the full set, with counts for the chip labels.
  const { namespaceFacets, tagFacets } = useMemo(() => {
    const nsCounts = new Map<string, number>();
    const tagCounts = new Map<string, number>();
    for (const item of items) {
      const ns = namespaceOf(item.key);
      nsCounts.set(ns, (nsCounts.get(ns) ?? 0) + 1);
      for (const t of item.tags ?? []) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
    }
    const sortByCount = (m: Map<string, number>) =>
      [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    return { namespaceFacets: sortByCount(nsCounts), tagFacets: sortByCount(tagCounts) };
  }, [items]);

  const matcher = useMemo(() => buildMatcher(q, mode), [q, mode]);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (namespaces.size && !namespaces.has(namespaceOf(item.key))) return false;
      if (tags.size) {
        const itemTags = new Set(item.tags ?? []);
        const ok = tagMode === 'all' ? [...tags].every((t) => itemTags.has(t)) : [...tags].some((t) => itemTags.has(t));
        if (!ok) return false;
      }
      if (matcher.kind === 'empty') return true;
      return fieldMatches(item.key, matcher) || fieldMatches(item.display_name, matcher);
    });
  }, [items, namespaces, tags, tagMode, matcher]);

  const toggleSet = (setter: typeof setNamespaces, value: string) =>
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });

  const filtersActive = q.trim() !== '' || namespaces.size > 0 || tags.size > 0 || mode !== 'contains';

  const reset = () => {
    setQ('');
    setMode('contains');
    setNamespaces(new Set());
    setTags(new Set());
    setTagMode('any');
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="glass-panel flex flex-col gap-4 rounded-lg border p-4">
        {/* Search row */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative min-w-[260px] flex-1 space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-foreground/50">Search</Label>
            <Search className="pointer-events-none absolute left-3 top-[34px] h-4 w-4 text-foreground/40" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={mode === 'regex' ? '^betterpvp:.*_ore$' : 'diamond'}
              className={cn('pl-9 font-mono', matcher.kind === 'error' && 'border-destructive focus-visible:ring-destructive')}
              spellCheck={false}
            />
          </div>
          <Segmented
            label="Match"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'contains', label: 'Contains' },
              { value: 'exact', label: 'Exact' },
              { value: 'regex', label: 'Regex' },
            ]}
          />
        </div>

        {matcher.kind === 'error' && (
          <p className="text-xs text-destructive">Invalid regex: {matcher.message}</p>
        )}

        {/* Namespace facet */}
        <FacetChips
          label="Namespace"
          facets={namespaceFacets}
          selected={namespaces}
          onToggle={(v) => toggleSet(setNamespaces, v)}
          onClear={() => setNamespaces(new Set())}
        />

        {/* Tag facet */}
        {tagFacets.length > 0 && (
          <FacetChips
            label="Tags"
            facets={tagFacets}
            selected={tags}
            onToggle={(v) => toggleSet(setTags, v)}
            onClear={() => setTags(new Set())}
            extra={
              tags.size > 1 ? (
                <Segmented
                  value={tagMode}
                  onChange={setTagMode}
                  options={[
                    { value: 'any', label: 'Any' },
                    { value: 'all', label: 'All' },
                  ]}
                />
              ) : null
            }
          />
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-foreground/60">
          <span className="font-semibold text-foreground">{filtered.length}</span> of {items.length} items
        </p>
        {filtersActive && (
          <Button type="button" size="sm" variant="ghost" className="gap-1.5" onClick={reset}>
            <X className="h-3.5 w-3.5" /> Reset filters
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="glass-panel rounded-lg border p-10 text-center text-foreground/50">No items match these filters.</div>
      ) : (
        <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {filtered.map((item) => (
            <li key={item.key} className="glass-panel flex items-center justify-between rounded-lg border px-3 py-2">
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium">{item.display_name}</span>
                <span className="truncate font-mono text-xs text-foreground/45">{item.key}</span>
                {item.tags?.length > 0 && (
                  <span className="mt-0.5 truncate text-[10px] text-foreground/35">{item.tags.join(' · ')}</span>
                )}
              </div>
              <Badge variant={item.source === 'custom' ? 'info' : 'outline'}>{item.source}</Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** A labelled segmented button group bound to a string-union value. */
function Segmented<T extends string>({
  label, value, onChange, options,
}: {
  label?: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="space-y-1.5">
      {label && <Label className="text-xs uppercase tracking-wide text-foreground/50">{label}</Label>}
      <div className="inline-flex rounded-md border border-border/60 p-0.5">
        {options.map((o) => (
          <Button
            key={o.value}
            type="button"
            size="sm"
            variant={value === o.value ? 'default' : 'ghost'}
            className="h-7 px-2.5 text-xs"
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

/** A wrap of toggleable facet chips with a count badge and clear control. */
function FacetChips({
  label, facets, selected, onToggle, onClear, extra,
}: {
  label: string;
  facets: [string, number][];
  selected: Set<string>;
  onToggle: (value: string) => void;
  onClear: () => void;
  extra?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-3">
        <Label className="text-xs uppercase tracking-wide text-foreground/50">{label}</Label>
        {selected.size > 0 && (
          <button type="button" className="text-[11px] text-foreground/45 underline-offset-2 hover:underline" onClick={onClear}>
            clear ({selected.size})
          </button>
        )}
        {extra}
      </div>
      <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
        {facets.map(([value, count]) => {
          const active = selected.has(value);
          return (
            <button
              key={value}
              type="button"
              onClick={() => onToggle(value)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-xs transition-colors',
                active
                  ? 'border-primary/45 bg-primary/14 text-primary'
                  : 'border-border bg-transparent text-foreground/70 hover:border-border/80 hover:text-foreground',
              )}
            >
              <span className="font-mono">{value}</span>
              <span className="text-[10px] text-foreground/40">{count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
