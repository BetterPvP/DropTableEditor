// Backwards-compatible shim. The loot-table domain model now lives with its
// content type at lib/content/loot_table/schema.ts. Kept so the simulation
// worker and sample fixtures continue to resolve during the Phase 1 port.
export * from '@/lib/content/loot_table/schema';
