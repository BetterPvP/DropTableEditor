'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { sampleLootTables } from '@/lib/loot-tables/sample';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bookmark, Pin } from 'lucide-react';

interface OpenTabsPanelProps {
  activeId: string;
}

export function OpenTabsPanel({ activeId }: OpenTabsPanelProps) {
  const tables = useMemo(() => sampleLootTables, []);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-foreground/60">
          <Bookmark className="h-4 w-4" /> Open tables
        </div>
        <Button variant="ghost" size="icon" aria-label="Pin panel">
          <Pin className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <ul className="space-y-2 px-3 pb-6">
          {tables.map((table) => {
            const isActive = table.id === activeId;
            return (
              <li key={table.id}>
                <Link
                  href={`/loot-tables/${table.id}`}
                  className={cn(
                    'flex items-center justify-between gap-3 rounded-2xl border border-transparent bg-white/5 px-3 py-2 text-sm transition hover:border-primary/40 hover:bg-primary/10',
                    isActive && 'border-primary/50 bg-primary/20 text-primary-foreground',
                  )}
                >
                  <span className="truncate font-medium">{table.name}</span>
                  {isActive ? <Badge variant="info">Active</Badge> : <span className="text-xs text-foreground/40">v{table.version}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </ScrollArea>
    </div>
  );
}
