"use client";

import { useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";

export function JSONPreview({ value }: { value: unknown }) {
  const formatted = useMemo(() => JSON.stringify(value, null, 2), [value]);
  return (
    <div className="glass-panel h-full overflow-hidden rounded-xl border border-white/10">
      <ScrollArea className="h-full max-h-[400px]">
        <pre className="whitespace-pre-wrap p-4 text-xs text-primary-foreground/90">{formatted}</pre>
      </ScrollArea>
    </div>
  );
}
