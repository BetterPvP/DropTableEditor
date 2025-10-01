"use client";

import * as React from "react";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "./toast";

export type ToastMessage = {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  variant?: "default" | "destructive";
};

type ToastContextValue = {
  toasts: ToastMessage[];
  toast: (toast: Omit<ToastMessage, "id"> & { id?: string }) => void;
  dismiss: (id: string) => void;
};

const ToastContext = React.createContext<ToastContextValue | undefined>(undefined);

export function ToastProviderContext({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastMessage[]>([]);

  const toast = React.useCallback((toast: Omit<ToastMessage, "id"> & { id?: string }) => {
    setToasts((current) => [...current, { ...toast, id: toast.id ?? crypto.randomUUID() }]);
  }, []);

  const dismiss = React.useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      <ToastProvider swipeDirection="right">
        {children}
        {toasts.map(({ id, title, description, variant, action }) => (
          <Toast key={id} variant={variant} onOpenChange={(open) => !open && dismiss(id)}>
            <ToastTitle>{title}</ToastTitle>
            {description ? <ToastDescription>{description}</ToastDescription> : null}
            {action}
            <ToastClose />
          </Toast>
        ))}
        <ToastViewport />
      </ToastProvider>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProviderContext");
  return context;
}
