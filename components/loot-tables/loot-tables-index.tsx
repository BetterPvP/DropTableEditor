'use client';

import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { sampleLootTables } from '@/lib/loot-tables/sample';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Clock3, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface LootTablesIndexProps {
  query: string;
}

export function LootTablesIndex({ query }: LootTablesIndexProps) {
  const [value, setValue] = useState(query);
  const router = useRouter();
  const [, startTransition] = useTransition();

  const tables = useMemo(() => {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return sampleLootTables;
    return sampleLootTables.filter((table) =>
      [table.name, table.description, table.tags?.join(' ') ?? '']
        .join(' ')
        .toLowerCase()
        .includes(normalized),
    );
  }, [value]);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(() => {
      const params = new URLSearchParams();
      if (value.trim()) params.set('q', value.trim());
      router.replace(`/loot-tables${params.toString() ? `?${params}` : ''}`);
    });
  };

  return (
    <div className="space-y-8">
      <div className="glass-panel flex flex-col gap-6 rounded-3xl border border-white/10 p-8">
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-semibold text-white">Loot Tables</h1>
          <p className="text-sm text-foreground/70">
            Search, filter, and jump into any loot table. All data loads server-side with optimistic hydration for deep links.
          </p>
        </div>
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
          <span>{tables.length} tables</span>
          <span>Sample data mirrored from legacy editor for parity testing.</span>
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {tables.map((table) => (
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
              <Button asChild className="justify-between">
                <Link href={`/loot-tables/${table.id}`}>
                  Open editor
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
        {tables.length === 0 && (
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
