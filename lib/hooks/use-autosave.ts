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
}

type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function useAutosave<T>({
  value,
  onSave,
  onCreateSnapshot,
  debounceMs = 1000,
  idleSnapshotMs = 30 * 60 * 1000,
  getIdleSnapshotLabel,
}: AutosaveOptions<T>) {
  const [status, setStatus] = useState<AutosaveStatus>('idle');
  const [dirty, setDirty] = useState(false);
  const lastSavedRef = useRef<T | null>(null);
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
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void performSave();
    }, debounceMs);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [debounceMs, performSave, value]);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      void performSave();
    }, 15000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [performSave]);

  useEffect(() => {
    if (typeof window === 'undefined' || !onCreateSnapshot) {
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
  }, [createSnapshot, getIdleSnapshotLabel, idleSnapshotMs, onCreateSnapshot, value]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleBeforeUnload = () => {
      void performSave();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [performSave]);

  const handleBlur = useCallback(() => {
    void performSave();
  }, [performSave]);

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
