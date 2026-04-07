'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { UserPresence } from '@/lib/hooks/use-presence';

export interface PresenceFieldProps {
  fieldId: string;
  presence: UserPresence[];
  children: ReactNode;
  className?: string;
}

export function PresenceField({ fieldId, presence, children, className }: PresenceFieldProps) {
  const activePresence = presence.find((user) => user.focusedField === fieldId) ?? null;

  return (
    <div className={cn('relative', className)}>
      <div
        className={cn(
          'rounded-md transition-shadow',
          activePresence && 'border-2 p-[3px]',
        )}
        style={activePresence ? { borderColor: activePresence.color } : undefined}
      >
        {children}
      </div>
      {activePresence ? (
        <span
          className="pointer-events-none absolute -top-2 right-2 rounded-full px-2 py-0.5 text-[11px] font-medium text-white shadow"
          style={{ backgroundColor: activePresence.color }}
        >
          {activePresence.displayName}
        </span>
      ) : null}
    </div>
  );
}
