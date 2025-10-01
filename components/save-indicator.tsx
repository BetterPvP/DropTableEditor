'use client';

import { useMemo } from 'react';
import { Loader2, ShieldCheck, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface SaveIndicatorProps {
  status: 'idle' | 'saving' | 'saved' | 'error';
}

export function SaveIndicator({ status }: SaveIndicatorProps) {
  const { icon, label, tone } = useMemo(() => {
    switch (status) {
      case 'saving':
        return { icon: <Loader2 className="h-4 w-4 animate-spin" />, label: 'Saving…', tone: 'info' as const };
      case 'saved':
        return { icon: <ShieldCheck className="h-4 w-4" />, label: 'Saved', tone: 'default' as const };
      case 'error':
        return { icon: <TriangleAlert className="h-4 w-4" />, label: 'Retry needed', tone: 'destructive' as const };
      default:
        return { icon: <ShieldCheck className="h-4 w-4" />, label: 'Idle', tone: 'default' as const };
    }
  }, [status]);

  return (
    <Badge variant={tone} className="flex items-center gap-2">
      {icon}
      {label}
    </Badge>
  );
}
