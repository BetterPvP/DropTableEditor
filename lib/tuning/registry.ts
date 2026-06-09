/**
 * Editable game-tuning tables: each is a `(key, definition jsonb)` table the
 * game reads directly. The console edits the JSON `definition` per row. Table +
 * key-column names come from this fixed registry (never user input), so they're
 * safe to interpolate into SQL.
 */
export interface TuningTableDef {
  slug: string;
  table: string;
  keyColumn: string;
  label: string;
  description: string;
  sample: { key: string; definition: unknown };
}

export const TUNING_TABLES: TuningTableDef[] = [
  {
    slug: 'purity-distributions',
    table: 'purity_distributions',
    keyColumn: 'name',
    label: 'Purity Distributions',
    description: 'Rarity weights per named distribution (the roll table for item purity).',
    sample: {
      key: 'default',
      definition: {
        distribution_name: 'default',
        weights: { PITIFUL: 5, FRAGILE: 20, MODERATE: 35, POLISHED: 25, PRISTINE: 12, PERFECT: 3 },
      },
    },
  },
  {
    slug: 'purity-reforge-bias',
    table: 'purity_reforge_bias',
    keyColumn: 'purity',
    label: 'Reforge Bias',
    description: 'Beta-distribution alpha/beta per purity (how reforging skews stats). Both must be > 0.',
    sample: {
      key: 'MODERATE',
      definition: { purity: 'MODERATE', alpha: 1.2, beta: 1.6, notes: '' },
    },
  },
  {
    slug: 'purity-rune-slots',
    table: 'purity_rune_slot_distributions',
    keyColumn: 'purity',
    label: 'Rune-Slot Distributions',
    description: 'Socket-count weights (keys 0-4) per purity for sockets and max sockets.',
    sample: {
      key: 'PERFECT',
      definition: {
        purity: 'PERFECT',
        socket_weights: { '0': 1, '1': 2, '2': 10, '3': 35, '4': 52 },
        max_socket_weights: { '0': 1, '1': 2, '2': 7, '3': 25, '4': 65 },
        notes: '',
      },
    },
  },
];

export function tuningBySlug(slug: string): TuningTableDef | undefined {
  return TUNING_TABLES.find((t) => t.slug === slug);
}
