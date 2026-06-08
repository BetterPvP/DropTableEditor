import { notFound } from 'next/navigation';
import { contentTypeBySlug } from '@/lib/content/registry';
import { getContent } from '@/lib/db/repositories/content';
import { SimulationWorkspace } from '@/components/simulation/simulation-workspace';
import type { LootTableDefinition } from '@/lib/content/loot_table/schema';

// Simulation is loot-table specific.
export default async function SimulatePage({ params }: { params: { type: string; id: string } }) {
  const def = contentTypeBySlug(params.type);
  if (!def || def.type !== 'loot_table') notFound();

  const record = await getContent(params.id);
  if (!record || record.type !== 'loot_table') notFound();

  return <SimulationWorkspace id={record.id} name={record.name} definition={record.draft as LootTableDefinition} />;
}
