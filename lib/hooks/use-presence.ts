'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createBrowserSupabaseClient } from '@/supabase/client';

export type UserPresence = {
  userId: string;
  sessionId: string;
  displayName: string;
  color: string;
  focusedField: string | null;
  joinedAt: number;
};

interface UsePresenceIdentity {
  userId: string;
  sessionId: string;
  displayName: string;
  color?: string;
}

function getUserColor(userId: string) {
  return `hsl(${parseInt(userId.slice(0, 8), 16) % 360}, 70%, 55%)`;
}

export function usePresence(tableId: string, identity: UsePresenceIdentity) {
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [others, setOthers] = useState<UserPresence[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const joinedAtRef = useRef(Date.now());

  const myPresence = useMemo<UserPresence>(() => ({
    userId: identity.userId,
    sessionId: identity.sessionId,
    displayName: identity.displayName,
    color: identity.color ?? getUserColor(identity.userId),
    focusedField,
    joinedAt: joinedAtRef.current,
  }), [focusedField, identity.color, identity.displayName, identity.sessionId, identity.userId]);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    const channel = supabase.channel(`collab:loot-table:${tableId}`, {
      config: {
        presence: { key: identity.sessionId },
      },
    });

    channelRef.current = channel;

    const syncOthers = () => {
      const state = channel.presenceState<UserPresence>();
      const nextOthers = Object
        .values(state)
        .flat()
        .filter((presence) => presence.sessionId !== identity.sessionId)
        .sort((a, b) => a.joinedAt - b.joinedAt);
      setOthers(nextOthers);
    };

    channel
      .on('presence', { event: 'sync' }, syncOthers)
      .on('presence', { event: 'join' }, syncOthers)
      .on('presence', { event: 'leave' }, syncOthers)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track(myPresence);
          syncOthers();
        }
      });

    return () => {
      setOthers([]);
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [identity.sessionId, identity.userId, tableId]);

  useEffect(() => {
    const channel = channelRef.current;
    if (!channel) {
      return;
    }

    void channel.track(myPresence);
  }, [myPresence]);

  return {
    others,
    trackFocus: (field: string) => setFocusedField(field),
    untrackFocus: () => setFocusedField(null),
  } as const;
}
