"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type AutosaveStatus = "idle" | "saving" | "saved" | "error";

type AutosaveOptions<T> = {
  key: string;
  version: number;
  onSave: (payload: { value: T; version: number }) => Promise<void>;
  enabled?: boolean;
};

export function useAutosave<T>(value: T, { key, version, onSave, enabled = true }: AutosaveOptions<T>) {
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const beforeUnloadRef = useRef<(event: BeforeUnloadEvent) => void>();

  const save = useCallback(async () => {
    if (!enabled) return;
    setStatus("saving");
    try {
      await onSave({ value, version });
      setStatus("saved");
      setLastSavedAt(new Date());
      if (typeof window !== "undefined") {
        localStorage.setItem(`${key}:draft`, JSON.stringify({ version, value }));
      }
    } catch (error) {
      console.error("Autosave error", error);
      setStatus("error");
    }
  }, [enabled, key, onSave, value, version]);

  useEffect(() => {
    if (!enabled) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      void save();
    }, 1000);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [enabled, save, value]);

  useEffect(() => {
    if (!enabled) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      void save();
    }, 15000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, save]);

  useEffect(() => {
    if (!enabled) return;
    const handler = (event: BeforeUnloadEvent) => {
      beforeUnloadRef.current = handler;
      void save();
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [enabled, save]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(`${key}:draft`);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      if (parsed.version !== version) return;
    } catch (error) {
      console.warn("Failed to parse draft", error);
    }
  }, [key, version]);

  return { status, lastSavedAt, saveManually: save };
}
