import { Metadata } from 'next';
import { Suspense } from 'react';
import { createServerSupabaseClient } from '@/supabase/server';
import { LootTablesIndex, LootTableListItem } from '@/components/loot-tables/loot-tables-index';
import { lootTableDefinitionSchema } from '@/lib/loot-tables/types';

export const metadata: Metadata = {
  title: 'Loot Tables | BetterPvP Admin Console',
};

async function Content({ query }: { query: string }) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('loot_tables')
    .select('id, name, description, updated_at, version, definition, metadata');

  if (error) {
    console.error('Failed to load loot tables', error);
  }

  const tables: LootTableListItem[] = (data ?? [])
    .map((table) => {
      const parsed = lootTableDefinitionSchema.safeParse({
        ...(typeof table.definition === 'object' ? table.definition : {}),
        id: table.id,
        name: table.name,
        description: table.description ?? undefined,
        updated_at: table.updated_at,
      });
      return {
        id: table.id,
        name: table.name,
        description: table.description,
        updated_at: table.updated_at,
        version: table.version,
        tags: Array.isArray((table.metadata as any)?.tags)
          ? ((table.metadata as any).tags as string[])
          : null,
        definition: parsed.success
          ? parsed.data
          : {
              id: table.id,
              name: table.name,
              description: table.description ?? undefined,
              notes: '',
              replacementStrategy: 'UNSET',
              rollStrategy: { type: 'CONSTANT', rolls: 1 },
              weightDistribution: 'STATIC',
              pityRules: [],
              progressive: undefined,
              entries: [],
              guaranteed: [],
              version: table.version,
              updated_at: table.updated_at,
            },
      } satisfies LootTableListItem;
    })
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  return <LootTablesIndex query={query} tables={tables} />;
}

export default function LootTablesPage({ searchParams }: { searchParams: { q?: string } }) {
  return (
    <Suspense fallback={<div className="text-sm text-foreground/60">Loading loot tables…</div>}>
      <Content query={searchParams.q ?? ''} />
    </Suspense>
  );
}
