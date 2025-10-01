'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface AutosaveOptions<T> {
  key: string;
  version: number;
  value: T;
  onSave: (payload: { value: T; version: number }) => Promise<void> | void;
  debounceMs?: number;
}

type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function useAutosave<T>({ key, version, value, onSave, debounceMs = 1000 }: AutosaveOptions<T>) {
  const [status, setStatus] = useState<AutosaveStatus>('idle');
  const [dirty, setDirty] = useState(false);
  const lastSavedRef = useRef<{ value: T; version: number } | null>(null);
  const debounceRef = useRef<NodeJS.Timeout>();
  const intervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const draftKey = `${key}:v${version}`;
    window.localStorage.setItem(draftKey, JSON.stringify(value));
    setDirty(true);
  }, [key, version, value]);

  const performSave = useCallback(async () => {
    if (!dirty) return;
    setStatus('saving');
    try {
      await onSave({ value, version });
      lastSavedRef.current = { value, version };
      setStatus('saved');
      setDirty(false);
    } catch (error) {
      console.error('Autosave failed', error);
      setStatus('error');
    }
  }, [dirty, onSave, value, version]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void performSave();
    }, debounceMs);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [debounceMs, performSave, value, version]);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      void performSave();
    }, 15000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [performSave]);

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
  } as const;
}
