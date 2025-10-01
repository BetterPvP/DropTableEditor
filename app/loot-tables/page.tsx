import { Metadata } from 'next';
import { Suspense } from 'react';
import { LootTablesIndex } from '@/components/loot-tables/loot-tables-index';

export const metadata: Metadata = {
  title: 'Loot Tables | BetterPvP Admin Console',
};

export default function LootTablesPage({ searchParams }: { searchParams: { q?: string } }) {
  return (
    <Suspense fallback={<div className="text-sm text-foreground/60">Loading loot tables…</div>}>
      <LootTablesIndex query={searchParams.q ?? ''} />
    </Suspense>
  );
}
