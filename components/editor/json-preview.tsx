'use client';

import { useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface JSONPreviewProps {
  data: unknown;
}

export function JSONPreview({ data }: JSONPreviewProps) {
  const formatted = useMemo(() => JSON.stringify(data, null, 2), [data]);
  return (
    <ScrollArea className="h-full max-h-[500px] rounded-xl border border-white/10 bg-black/40 p-4">
      <pre className="text-xs leading-relaxed text-foreground/80">{formatted}</pre>
    </ScrollArea>
  );
}
