'use client';

import { useEffect, useMemo, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { createBrowserSupabaseClient } from '@/supabase/client';
import type { UserPresence } from '@/lib/hooks/use-presence';
import { Bookmark, Pin } from 'lucide-react';

interface OpenTabsPanelProps {
  activeId: string;
  tables: {
    id: string;
    name: string;
    version: number;
  }[];
}

function PresenceAvatars({ presence }: { presence: UserPresence[] }) {
  const visible = presence.slice(0, 3);
  const overflow = presence.length - visible.length;

  if (presence.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center">
      {visible.map((user, index) => (
        <span
          key={`${user.userId}-${index}`}
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded-full border border-background text-[10px] font-semibold text-white',
            index > 0 && '-ml-2',
          )}
          style={{ backgroundColor: user.color }}
          title={user.displayName}
        >
          {user.displayName.slice(0, 1).toUpperCase()}
        </span>
      ))}
      {overflow > 0 ? (
        <span className="-ml-2 flex h-6 min-w-6 items-center justify-center rounded-full border border-background bg-muted px-1.5 text-[10px] font-semibold text-foreground/80">
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}

export function OpenTabsPanel({ activeId, tables }: OpenTabsPanelProps) {
  const [presenceByTableId, setPresenceByTableId] = useState<Record<string, UserPresence[]>>({});

  const tableIds = useMemo(() => tables.map((table) => table.id), [tables]);

  useEffect(() => {
    if (tableIds.length === 0) {
      setPresenceByTableId({});
      return;
    }

    const supabase = createBrowserSupabaseClient();
    const channels: RealtimeChannel[] = [];

    tableIds.forEach((tableId) => {
      const channel = supabase.channel(`collab:loot-table:${tableId}`);
      const syncPresence = () => {
        const state = channel.presenceState<UserPresence>();
        const nextPresence = Object.values(state).flat().sort((a, b) => a.joinedAt - b.joinedAt);
        setPresenceByTableId((prev) => ({ ...prev, [tableId]: nextPresence }));
      };

      channel
        .on('presence', { event: 'sync' }, syncPresence)
        .on('presence', { event: 'join' }, syncPresence)
        .on('presence', { event: 'leave' }, syncPresence)
        .subscribe();

      channels.push(channel);
    });

    return () => {
      channels.forEach((channel) => {
        void supabase.removeChannel(channel);
      });
    };
  }, [tableIds]);

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
            const presence = presenceByTableId[table.id] ?? [];

            return (
              <li key={table.id}>
                <Link
                  href={`/loot-tables/${table.id}`}
                  className={cn(
                    'flex items-center justify-between gap-3 rounded-md border border-transparent bg-muted/30 px-3 py-2 text-sm transition hover:border-primary/40 hover:bg-muted/65',
                    isActive && 'border-primary/45 bg-primary/12 text-primary-foreground',
                  )}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <PresenceAvatars presence={presence} />
                    <span className="truncate font-medium">{table.name}</span>
                  </div>
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
