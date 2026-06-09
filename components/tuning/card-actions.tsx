'use client';

import { Rocket, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

/** Shared Save (draft) / Publish (live) / Delete controls for a tuning card. */
export function CardActions({
  unpublished,
  busy,
  onSave,
  onPublish,
  onDelete,
}: {
  unpublished: boolean;
  busy: boolean;
  onSave: () => void;
  onPublish: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      {unpublished && (
        <Badge variant="outline" className="border-amber-500/50 text-amber-500">Unpublished</Badge>
      )}
      <Button type="button" size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={onSave} disabled={busy}>
        <Save className="h-4 w-4" /> Save
      </Button>
      <Button type="button" size="sm" className="gap-2" onClick={onPublish} disabled={busy}>
        <Rocket className="h-4 w-4" /> Publish
      </Button>
      <Button type="button" size="sm" variant="destructive" onClick={onDelete}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
