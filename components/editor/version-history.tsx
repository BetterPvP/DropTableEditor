'use client';

import { useState } from 'react';
import { History, RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { listSnapshotsAction, restoreSnapshotAction } from '@/lib/content/editor-actions';
import type { SnapshotSummary } from '@/lib/db/repositories/content';

/** Version-history dropdown: lists publish snapshots and restores one to live. */
export function VersionHistory({ contentId }: { contentId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [snapshots, setSnapshots] = useState<SnapshotSummary[] | null>(null);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    setSnapshots(null);
    setSnapshots(await listSnapshotsAction(contentId));
  };

  const restore = async (snapshotId: string) => {
    setBusy(true);
    const result = await restoreSnapshotAction(contentId, snapshotId);
    setBusy(false);
    if (result.ok) {
      setOpen(false);
      router.refresh();
    }
  };

  return (
    <div className="relative">
      <Button type="button" variant="ghost" className="gap-2" onClick={toggle}>
        <History className="h-4 w-4" /> History
      </Button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 max-h-80 w-72 overflow-y-auto rounded-md border bg-popover p-2 shadow-lg">
          {!snapshots && <p className="p-2 text-sm text-foreground/50">Loading…</p>}
          {snapshots && snapshots.length === 0 && (
            <p className="p-2 text-sm text-foreground/50">No published versions yet.</p>
          )}
          {snapshots?.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-2 rounded-sm px-2 py-1.5 hover:bg-muted/60">
              <div className="min-w-0">
                <div className="truncate text-sm">v{s.version} · {s.label ?? 'snapshot'}</div>
                <div className="text-xs text-foreground/40">{s.created_at ? new Date(s.created_at).toLocaleString() : ''}</div>
              </div>
              <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => restore(s.id)} title="Restore to live">
                <RotateCcw className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
