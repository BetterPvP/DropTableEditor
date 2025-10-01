'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

interface TransparencyContextValue {
  reduced: boolean;
  toggle: () => void;
  setReduced: (value: boolean) => void;
}

const TransparencyContext = createContext<TransparencyContextValue | undefined>(undefined);

const STORAGE_KEY = 'betterpvp:transparency';

export function TransparencyProvider({ children }: { children: React.ReactNode }) {
  const [reduced, setReducedState] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setReducedState(stored === 'true');
    }
  }, []);

  useEffect(() => {
    document.body.classList.toggle('reduced-transparency', reduced);
    window.localStorage.setItem(STORAGE_KEY, reduced ? 'true' : 'false');
  }, [reduced]);

  const value = useMemo<TransparencyContextValue>(
    () => ({
      reduced,
      toggle: () => setReducedState((prev) => !prev),
      setReduced: setReducedState,
    }),
    [reduced],
  );

  return <TransparencyContext.Provider value={value}>{children}</TransparencyContext.Provider>;
}

export function useTransparency() {
  const ctx = useContext(TransparencyContext);
  if (!ctx) {
    throw new Error('useTransparency must be used within TransparencyProvider');
  }
  return ctx;
}
