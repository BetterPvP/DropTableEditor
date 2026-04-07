'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { LootTableDefinition } from '@/lib/loot-tables/types';
import { createBrowserSupabaseClient } from '@/supabase/client';

export type FieldPatch = {
  senderId: string;
  path: string;
  value: unknown;
  timestamp: number;
};

function deepSetValue(target: unknown, segments: string[], value: unknown): unknown {
  if (segments.length === 0) {
    return value;
  }

  const [segment, ...rest] = segments;

  if (Array.isArray(target)) {
    const nextIndex = Number(segment);
    if (Number.isInteger(nextIndex) && nextIndex >= 0 && nextIndex < target.length) {
      return target.map((item, index) => (
        index === nextIndex ? deepSetValue(item, rest, value) : item
      ));
    }

    return target.map((item) => {
      if (
        item &&
        typeof item === 'object' &&
        'id' in item &&
        typeof item.id === 'string' &&
        item.id === segment
      ) {
        return deepSetValue(item, rest, value);
      }

      return item;
    });
  }

  if (target && typeof target === 'object') {
    return {
      ...(target as Record<string, unknown>),
      [segment]: deepSetValue((target as Record<string, unknown>)[segment], rest, value),
    };
  }

  return { [segment]: deepSetValue(undefined, rest, value) };
}

function applyPatch(definition: LootTableDefinition, patch: FieldPatch): LootTableDefinition {
  const segments = patch.path.split('.').filter(Boolean);
  if (segments.length === 0) {
    return definition;
  }

  return deepSetValue(definition, segments, patch.value) as LootTableDefinition;
}

export function useCollabSync(
  tableId: string,
  definition: LootTableDefinition,
  setDefinition: (definition: LootTableDefinition) => void,
  sessionId: string,
) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const latestDefinitionRef = useRef(definition);
  const isApplyingRemoteRef = useRef(false);

  useEffect(() => {
    latestDefinitionRef.current = definition;
  }, [definition]);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    const channel = supabase.channel(`collab:loot-table:${tableId}`, {
      config: {
        broadcast: { self: false },
      },
    });

    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'patch' }, ({ payload }) => {
        const patch = payload as FieldPatch;
        if (!patch || patch.senderId === sessionId) {
          return;
        }

        isApplyingRemoteRef.current = true;
        const nextDefinition = applyPatch(latestDefinitionRef.current, patch);
        latestDefinitionRef.current = nextDefinition;
        setDefinition(nextDefinition);
        queueMicrotask(() => {
          isApplyingRemoteRef.current = false;
        });
      })
      .subscribe();

    return () => {
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [setDefinition, tableId, sessionId]);

  const broadcastPatch = useCallback((path: string, value: unknown) => {
    const channel = channelRef.current;
    if (!channel || isApplyingRemoteRef.current) {
      return;
    }

    const payload: FieldPatch = {
      senderId: sessionId,
      path,
      value,
      timestamp: Date.now(),
    };

    void channel.send({
      type: 'broadcast',
      event: 'patch',
      payload,
    });
  }, [sessionId]);

  return { broadcastPatch } as const;
}
