'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface AutosaveOptions<T> {
  key?: string;
  version?: number;
  value: T;
  onSave: (payload: { value: T }) => Promise<{ value?: T } | void> | { value?: T } | void;
  onCreateSnapshot?: (label?: string) => Promise<{ value?: T } | void> | { value?: T } | void;
  debounceMs?: number;
  idleSnapshotMs?: number;
  getIdleSnapshotLabel?: () => string;
  enabled?: boolean;
}

type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function useAutosave<T>({
  value,
  onSave,
  onCreateSnapshot,
  debounceMs = 1000,
  idleSnapshotMs = 30 * 60 * 1000,
  getIdleSnapshotLabel,
  enabled = true,
}: AutosaveOptions<T>) {
  const [status, setStatus] = useState<AutosaveStatus>('idle');
  const [dirty, setDirty] = useState(false);
  const lastSavedRef = useRef<T>(value);
  const debounceRef = useRef<NodeJS.Timeout>();
  const intervalRef = useRef<NodeJS.Timeout>();
  const idleSnapshotRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    setDirty(lastSavedRef.current !== value);
  }, [value]);

  const markClean = useCallback((nextValue: T) => {
    lastSavedRef.current = nextValue;
    setDirty(false);
    setStatus('saved');
  }, []);

  const performSave = useCallback(async () => {
    if (!dirty) {
      return;
    }

    setStatus('saving');
    try {
      const result = await onSave({ value });
      markClean(result?.value ?? value);
    } catch (error) {
      console.error('Autosave failed', error);
      setStatus('error');
    }
  }, [dirty, markClean, onSave, value]);

  const createSnapshot = useCallback(async (label?: string) => {
    if (!onCreateSnapshot) {
      return;
    }

    setStatus('saving');
    try {
      const result = await onCreateSnapshot(label);
      markClean(result?.value ?? value);
    } catch (error) {
      console.error('Snapshot creation failed', error);
      setStatus('error');
      throw error;
    }
  }, [markClean, onCreateSnapshot, value]);

  useEffect(() => {
    if (!enabled) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void performSave();
    }, debounceMs);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [debounceMs, performSave, value, enabled]);

  useEffect(() => {
    if (!enabled) return;
    intervalRef.current = setInterval(() => {
      void performSave();
    }, 15000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [performSave, enabled]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !onCreateSnapshot) {
      return;
    }

    if (idleSnapshotRef.current) clearTimeout(idleSnapshotRef.current);
    idleSnapshotRef.current = setTimeout(() => {
      const label = getIdleSnapshotLabel?.() ?? `Auto-save ${new Date().toLocaleString()}`;
      void createSnapshot(label);
    }, idleSnapshotMs);

    return () => {
      if (idleSnapshotRef.current) clearTimeout(idleSnapshotRef.current);
    };
  }, [createSnapshot, getIdleSnapshotLabel, idleSnapshotMs, onCreateSnapshot, value, enabled]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (enabled) {
        void performSave();
      } else if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    const handlePopState = (e: PopStateEvent) => {
      if (!enabled && dirty) {
        if (!window.confirm('You have unsaved changes. Are you sure you want to leave?')) {
          // Push the current state back to keep the user on the page
          window.history.pushState(null, '', window.location.href);
        }
      }
    };

    const handleClick = (e: MouseEvent) => {
      if (enabled || !dirty) return;

      const target = e.target as HTMLElement;
      const anchor = target.closest('a');

      if (anchor && anchor.href && anchor.host === window.location.host) {
        // Internal link
        const targetUrl = new URL(anchor.href);
        if (targetUrl.pathname === window.location.pathname && targetUrl.search === window.location.search) {
            // Same page, maybe a hash or just same URL
            return;
        }

        if (!window.confirm('You have unsaved changes. Are you sure you want to leave?')) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('click', handleClick, true); // Capture phase to intercept before Next.js
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('click', handleClick, true);
    };
  }, [performSave, enabled, dirty]);

  const handleBlur = useCallback(() => {
    if (!enabled) return;
    void performSave();
  }, [performSave, enabled]);

  return {
    status,
    dirty,
    lastSaved: lastSavedRef.current,
    handleBlur,
    saveNow: performSave,
    createSnapshot,
    markClean,
  } as const;
}
