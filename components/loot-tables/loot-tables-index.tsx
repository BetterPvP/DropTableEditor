'use client';

import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Clock3, Plus, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { LootTableDefinition } from '@/lib/loot-tables/types';
import { duplicateLootTableAction } from '@/app/loot-tables/actions';

export interface LootTableListItem {
  id: string;
  name: string;
  description?: string | null;
  updated_at: string;
  version: number;
  tags?: string[] | null;
  definition: LootTableDefinition;
}

interface LootTablesIndexProps {
  query: string;
  tables: LootTableListItem[];
}

export function LootTablesIndex({ query, tables }: LootTablesIndexProps) {
  const [value, setValue] = useState(query);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [, startDuplicate] = useTransition();

  const filteredTables = useMemo(() => {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return tables;
    return tables.filter((table) =>
      [table.name, table.description, table.tags?.join(' ') ?? '']
        .join(' ')
        .toLowerCase()
        .includes(normalized),
    );
  }, [value, tables]);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(() => {
      const params = new URLSearchParams();
      if (value.trim()) params.set('q', value.trim());
      router.replace(`/loot-tables${params.toString() ? `?${params}` : ''}`);
    });
  };

  const handleDuplicate = (tableId: string) => {
    setDuplicateError(null);
    setDuplicatingId(tableId);
    startDuplicate(() => {
      duplicateLootTableAction({ tableId })
        .then((result) => {
          if (!result?.ok) {
            setDuplicateError(result?.error ?? 'Unable to duplicate loot table.');
            return;
          }
          router.push(`/loot-tables/${result.id}`);
        })
        .catch((error) => {
          console.error('Duplicate action failed', error);
          setDuplicateError('Unable to duplicate loot table.');
        })
        .finally(() => {
          setDuplicatingId((current) => (current === tableId ? null : current));
          router.refresh();
        });
    });
  };

  return (
    <div className="space-y-8">
      <div className="glass-panel flex flex-col gap-6 rounded-3xl border border-white/10 p-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h1 className="text-3xl font-semibold text-white">Loot Tables</h1>
          <Button asChild className="w-full md:w-auto">
            <Link href="/loot-tables/new">
              <Plus className="h-4 w-4" />
              <span>Create loot table</span>
            </Link>
          </Button>
        </div>
        <p className="text-sm text-foreground/70">
          Search, filter, and jump into any loot table. All data loads server-side with optimistic hydration for deep links.
        </p>
        <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="search">Search tables</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
              <Input
                id="search"
                placeholder="Search by name, tag, or description"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <Button type="submit" className="sm:h-10 sm:self-end">
            Apply
          </Button>
        </form>
        <div className="flex flex-wrap gap-4 text-xs text-foreground/60">
          <span>{filteredTables.length} tables</span>
          <span>Data synchronises with Supabase in real time.</span>
        </div>
        {duplicateError && (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {duplicateError}
          </div>
        )}
      </div>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {filteredTables.map((table) => (
          <Card key={table.id} className="flex h-full flex-col justify-between">
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-3 text-white">
                <span className="truncate">{table.name}</span>
                <Badge variant="info">v{table.version}</Badge>
              </CardTitle>
              <CardDescription className="line-clamp-3 min-h-[3rem]">{table.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {table.tags && (
                <div className="flex flex-wrap gap-2">
                  {table.tags.map((tag) => (
                    <Badge key={tag} variant="default">
                      #{tag}
                    </Badge>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2 text-xs text-foreground/50">
                <Clock3 className="h-3.5 w-3.5" />
                <span>Updated {new Date(table.updated_at).toLocaleString()}</span>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button asChild className="justify-between sm:flex-1">
                  <Link href={`/loot-tables/${table.id}`}>
                    Open editor
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="sm:w-32"
                  disabled={duplicatingId === table.id}
                  onClick={() => handleDuplicate(table.id)}
                >
                  {duplicatingId === table.id ? 'Duplicating…' : 'Duplicate'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {filteredTables.length === 0 && (
          <Card className="col-span-full text-center">
            <CardHeader>
              <CardTitle>No tables found</CardTitle>
              <CardDescription>Try adjusting your search criteria.</CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    </div>
  );
}
