import { notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@/supabase/server';
import { LootTableEditor } from '@/components/editor/loot-table-editor';
import { lootTableDefinitionSchema } from '@/lib/loot-tables/types';

interface LootTableEditorPageProps {
  params: { id: string };
}

export const dynamic = 'force-dynamic';

export default async function LootTableEditorPage({ params }: LootTableEditorPageProps) {
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

  const { data: itemsData } = await supabase.from('items').select('*').order('name');
  const { data: openTabsData } = await supabase
    .from('loot_tables')
    .select('id, name, version')
    .order('updated_at', { ascending: false })
    .limit(8);
  const openTabs = [...(openTabsData ?? [])];
  if (!openTabs.some((tab) => tab.id === table.id)) {
    openTabs.unshift({ id: table.id, name: table.name, version: table.version });
  }

  return (
    <LootTableEditor
      tableId={table.id}
      definition={{ ...definition, version: table.version, updated_at: table.updated_at }}
      metadata={typeof table.metadata === 'object' ? (table.metadata as Record<string, unknown>) : null}
      items={itemsData ?? []}
      openTabs={openTabs.map((tab) => ({ id: tab.id, name: tab.name, version: tab.version }))}
    />
  );
}
