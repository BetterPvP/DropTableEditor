'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useAutosave } from '@/lib/hooks/use-autosave';
import { saveDraftAction, publishAction } from '@/lib/content/editor-actions';
import { deleteContentAction } from '@/lib/content/actions';
import type { ContentType } from '@/lib/db/types';

/**
 * Shared editor behaviour for every content type: optimistic-locked draft
 * autosave, publish (validate → published + snapshot + NOTIFY), delete, and
 * Ctrl+S. The body (form / graph / timeline) only renders `draft` and calls
 * `setDraft`; all persistence is identical across types.
 */
export function useContentEditor<T extends { name?: string }>(opts: {
  id: string;
  type: ContentType;
  slug: string;
  initialDraft: T;
  initialRevision: number;
  fallbackName: string;
}) {
  const [draft, setDraftState] = useState<T>(opts.initialDraft);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPublishing, startPublishing] = useTransition();
  const [isDeleting, startDeleting] = useTransition();
  const revisionRef = useRef(opts.initialRevision);

  const setDraft = useCallback((updater: T | ((prev: T) => T)) => {
    setDraftState((prev) => (typeof updater === 'function' ? (updater as (p: T) => T)(prev) : updater));
  }, []);

  const autosave = useAutosave<T>({
    value: draft,
    enabled: false,
    onSave: async ({ value }) => {
      setError(null);
      const name = value.name ?? opts.fallbackName;
      const result = await saveDraftAction({
        id: opts.id, type: opts.type, name, draft: value, baseRevision: revisionRef.current,
      });
      if (!result.ok) {
        const detail = !result.stale && result.issues ? `: ${result.issues.join('; ')}` : '';
        setError(`${result.error}${detail}`);
        throw new Error(result.error);
      }
      revisionRef.current = result.revision;
      return { value };
    },
  });

  const publish = useCallback(() => {
    startPublishing(async () => {
      setError(null);
      setNotice(null);
      if (autosave.dirty) {
        try {
          await autosave.saveNow();
        } catch {
          return;
        }
      }
      const result = await publishAction({ id: opts.id, type: opts.type, draft });
      if (!result.ok) {
        const detail = result.issues ? `: ${result.issues.join('; ')}` : '';
        setError(`${result.error}${detail}`);
        return;
      }
      setNotice(`Published v${result.version} — live in game on reload.`);
    });
  }, [autosave, draft, opts.id, opts.type]);

  const remove = useCallback(() => {
    if (typeof window !== 'undefined' && !window.confirm('Delete this permanently? This cannot be undone.')) {
      return;
    }
    startDeleting(async () => {
      autosave.markClean(draft);
      await deleteContentAction(opts.slug, opts.id); // redirects on success
    });
  }, [autosave, draft, opts.slug, opts.id]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (autosave.dirty && autosave.status !== 'saving') void autosave.saveNow();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [autosave]);

  return {
    draft,
    setDraft,
    error,
    notice,
    status: autosave.status,
    dirty: autosave.dirty,
    saveNow: autosave.saveNow,
    handleBlur: autosave.handleBlur,
    publish,
    isPublishing,
    remove,
    isDeleting,
  };
}
