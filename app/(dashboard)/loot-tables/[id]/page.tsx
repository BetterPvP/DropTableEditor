import { notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@/supabase/server';
import { LootTableEditor } from '@/components/editor/loot-table-editor';
import { lootTableDefinitionSchema } from '@/lib/loot-tables/types';
import { fetchAllItems } from '@/lib/items/queries';
import type { ItemRow } from '@/lib/items/queries';

interface LootTableEditorPageProps {
  params: { id: string };
}

export const dynamic = 'force-dynamic';

export default async function LootTableEditorPage({ params }: LootTableEditorPageProps) {
  const supabase = createServerSupabaseClient();
  const [{ data: table, error }, { data: auth }] = await Promise.all([
    supabase
      .from('loot_tables')
      .select('id, name, description, version, updated_at, definition, metadata')
      .eq('id', params.id)
      .maybeSingle(),
    supabase.auth.getUser(),
  ]);

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
        awardStrategy: { type: 'DEFAULT' } as const,
        entries: [],
        guaranteed: [],
        version: table.version,
        updated_at: table.updated_at,
      };

  let itemsData: ItemRow[] = [];
  try {
    itemsData = await fetchAllItems(supabase, { sortBy: 'id', sortDir: 'asc' });
  } catch (itemsError) {
    console.error('Failed to load items for editor', itemsError);
  }

  const user = auth.user;
  const userId = user?.id ?? '00000000-0000-0000-0000-000000000000';
  const displayName =
    user?.user_metadata?.full_name ??
    user?.user_metadata?.name ??
    user?.email?.split('@')[0] ??
    'Anonymous';
  const color = `hsl(${parseInt(userId.slice(0, 8), 16) % 360}, 70%, 55%)`;

  return (
    <LootTableEditor
      tableId={table.id}
      definition={{ ...definition, version: table.version, updated_at: table.updated_at }}
      metadata={typeof table.metadata === 'object' ? (table.metadata as Record<string, unknown>) : null}
      items={itemsData}
      userId={userId}
      displayName={displayName}
      color={color}
    />
  );
}
