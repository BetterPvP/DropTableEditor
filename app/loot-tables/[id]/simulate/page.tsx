import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { createServerSupabaseClient } from '@/supabase/server';
import { SimulationWorkspace } from '@/components/simulation/simulation-workspace';
import { computeWeightTotals, lootTableDefinitionSchema } from '@/lib/loot-tables/types';
import { fetchAllItems } from '@/lib/items/queries';
import type { ItemRow } from '@/lib/items/queries';

interface SimulationPageProps {
  params: { id: string };
}

export const dynamic = 'force-dynamic';

export default async function LootTableSimulationPage({ params }: SimulationPageProps) {
  const supabase = createServerSupabaseClient();
  const { data: table, error } = await supabase
    .from('loot_tables')
    .select('id, name, description, version, updated_at, definition, metadata')
    .eq('id', params.id)
    .maybeSingle();

  if (error) {
    console.error('Failed to load loot table', error);
  }

  if (!table) {
    notFound();
  }

  const definitionResult = lootTableDefinitionSchema.safeParse({
    ...(typeof table.definition === 'object' ? table.definition : {}),
    id: table.id,
    name: table.name,
    description: table.description ?? undefined,
    updated_at: table.updated_at,
    version: table.version,
  });

  const definition = definitionResult.success
    ? definitionResult.data
    : {
        id: table.id,
        name: table.name,
        description: table.description ?? undefined,
        notes: '',
        awardStrategy: { type: 'DEFAULT' } as const,
        replacementStrategy: 'UNSET' as const,
        rollStrategy: { type: 'CONSTANT', rolls: 1 } as const,
        weightDistribution: 'STATIC' as const,
        pityRules: [],
        progressive: undefined,
        entries: [],
        guaranteed: [],
        version: table.version,
        updated_at: table.updated_at,
      };

  let itemsData: ItemRow[] = [];
  try {
    itemsData = await fetchAllItems(supabase, { orderBy: 'name', ascending: true });
  } catch (itemsError) {
    console.error('Failed to load items for simulation', itemsError);
  }

  const { probabilities } = computeWeightTotals(definition.entries);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-slate-900/60 px-6 py-4 backdrop-blur-xl">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-white">{definition.name}</h1>
          <p className="text-sm text-foreground/60">
            Simulation workspace · Version {definition.version} · Last updated {new Date(definition.updated_at).toLocaleString()}
          </p>
        </div>
        <Link
          href={`/loot-tables/${table.id}`}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-4 py-2 text-sm text-foreground/80 transition hover:border-primary/40 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Back to editor
        </Link>
      </div>
      <SimulationWorkspace definition={definition} probabilities={probabilities} items={itemsData} />
    </div>
  );
}
