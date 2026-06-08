'use client';

import Link from 'next/link';
import { ChangeEvent } from 'react';
import { Download, Rocket, Save, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SaveIndicator } from '@/components/save-indicator';
import { VersionHistory } from './version-history';

type Status = 'idle' | 'saving' | 'saved' | 'error';

interface EditorHeaderProps {
  title: string;
  contentId: string;
  backHref: string;
  backLabel: string;
  status: Status;
  dirty: boolean;
  isPublishing: boolean;
  isDeleting: boolean;
  error: string | null;
  notice: string | null;
  draft: unknown;
  exportName: string;
  onSave: () => void;
  onPublish: () => void;
  onDelete: () => void;
  onImport: (parsed: unknown) => void;
}

export function EditorHeader(props: EditorHeaderProps) {
  const handleExport = () => {
    const blob = new Blob([JSON.stringify(props.draft, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${props.exportName.toLowerCase().replace(/\s+/g, '_')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      props.onImport(JSON.parse(await file.text()));
    } catch {
      props.onImport(null);
    }
    event.target.value = '';
  };

  return (
    <div className="space-y-3">
      <Link href={props.backHref} className="text-sm text-foreground/50 hover:text-primary">
        ← {props.backLabel}
      </Link>
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-card/95 px-6 py-4 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-white">{props.title}</h1>
          <Badge variant="outline" className={props.dirty ? 'border-amber-500/50 text-amber-500' : ''}>
            {props.dirty ? 'Unsaved' : 'Synced'}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SaveIndicator status={props.status} />
          <Button
            type="button"
            className="gap-2 bg-emerald-600 hover:bg-emerald-700"
            onClick={props.onSave}
            disabled={props.status === 'saving' || !props.dirty}
          >
            <Save className="h-4 w-4" />
            {props.status === 'saving' ? 'Saving...' : 'Save'}
          </Button>
          <Button type="button" className="gap-2" onClick={props.onPublish} disabled={props.isPublishing || props.status === 'saving'}>
            <Rocket className="h-4 w-4" />
            {props.isPublishing ? 'Publishing...' : 'Publish'}
          </Button>
          <VersionHistory contentId={props.contentId} />
          <Button type="button" variant="ghost" className="gap-2" onClick={handleExport}>
            <Download className="h-4 w-4" /> Export
          </Button>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-sm border border-primary/40 bg-primary/12 px-3 py-2 text-sm text-primary hover:bg-primary/18">
            <Upload className="h-4 w-4" /> Import
            <input type="file" accept="application/json" className="hidden" onChange={handleImport} />
          </label>
          <Button type="button" variant="destructive" className="gap-2" onClick={props.onDelete} disabled={props.isDeleting}>
            <Trash2 className="h-4 w-4" /> {props.isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </div>
      {props.error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {props.error}
        </div>
      )}
      {props.notice && (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
          {props.notice}
        </div>
      )}
    </div>
  );
}
