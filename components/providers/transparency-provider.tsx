"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "betterpvp:reduce-transparency";

type TransparencyContextValue = {
  reduced: boolean;
  toggle: () => void;
};

const TransparencyContext = createContext<TransparencyContextValue | undefined>(undefined);

export function TransparencyProvider({ children }: { children: React.ReactNode }) {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    setReduced(stored === "1");
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.toggle("reduce-transparency", reduced);
  }, [reduced]);

  const value = useMemo(
    () => ({
      reduced,
      toggle: () => {
        setReduced((prev) => {
          const next = !prev;
          if (typeof window !== "undefined") {
            localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
          }
          return next;
        });
      },
    }),
    [reduced],
  );

  return <TransparencyContext.Provider value={value}>{children}</TransparencyContext.Provider>;
}

export function useTransparency() {
  const ctx = useContext(TransparencyContext);
  if (!ctx) throw new Error("useTransparency must be used within TransparencyProvider");
  return ctx;
}
