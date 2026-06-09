/** Purity levels in order, with display names and colours (match the game). */
export interface PurityMeta {
  key: string;
  label: string;
  color: string;
}

export const PURITIES: PurityMeta[] = [
  { key: 'PITIFUL', label: 'Pitiful', color: '#9ca3af' },
  { key: 'FRAGILE', label: 'Fragile', color: '#e5e7eb' },
  { key: 'MODERATE', label: 'Moderate', color: '#22c55e' },
  { key: 'POLISHED', label: 'Polished', color: '#3b82f6' },
  { key: 'PRISTINE', label: 'Pristine', color: '#c084fc' },
  { key: 'PERFECT', label: 'Perfect', color: '#eab308' },
];

export function purityMeta(key: string): PurityMeta | undefined {
  return PURITIES.find((p) => p.key === key);
}

/** Read a numeric weight map from an unknown definition object, key -> number. */
export function readWeights(source: unknown, keys: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  const obj = (source ?? {}) as Record<string, unknown>;
  for (const key of keys) {
    const value = obj[key];
    out[key] = typeof value === 'number' ? value : Number(value) || 0;
  }
  return out;
}
