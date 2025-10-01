import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateTime(date: string | number | Date) {
  const value = typeof date === "string" ? new Date(date) : new Date(date);
  return value.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatPercent(value: number, digits = 2) {
  return `${(value * 100).toFixed(digits)}%`;
}

export const isBrowser = typeof window !== "undefined";
