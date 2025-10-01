'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '@/supabase/server';
import { lootTableDefinitionSchema } from '@/lib/loot-tables/types';

export async function duplicateLootTableAction({
  tableId,
}: {
  tableId: string;
}) {
  if (!tableId) {
    return { ok: false, error: 'Missing loot table identifier.' } as const;
  }

  const supabase = createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id ?? null;

  if (!userId) {
    return { ok: false, error: 'Not authenticated' } as const;
  }

  const { data: table, error } = await supabase
    .from('loot_tables')
    .select('id, name, description, definition, metadata')
    .eq('id', tableId)
    .maybeSingle();

  if (error || !table) {
    console.error('Failed to load loot table for duplication', error);
    return { ok: false, error: 'Unable to find the requested loot table.' } as const;
  }

  const timestamp = new Date().toISOString();
  const newId = crypto.randomUUID();
  const parsedDefinition = lootTableDefinitionSchema.parse({
    ...(typeof table.definition === 'object' ? table.definition : {}),
    id: table.id,
    name: table.name,
  });

  const duplicateName = `${parsedDefinition.name} (Copy)`;

  const duplicateDefinition = {
    ...parsedDefinition,
    id: newId,
    name: duplicateName,
    version: 1,
    updated_at: timestamp,
  };

  const { error: insertError } = await supabase.from('loot_tables').insert({
    id: newId,
    name: duplicateName,
    description: table.description,
    created_by: userId,
    updated_by: userId,
    created_at: timestamp,
    updated_at: timestamp,
    version: 1,
    metadata: table.metadata,
    definition: duplicateDefinition,
  });

  if (insertError) {
    console.error('Failed to duplicate loot table', insertError);
    return { ok: false, error: 'Unable to duplicate loot table.' } as const;
  }

  revalidatePath('/loot-tables');
  revalidatePath(`/loot-tables/${tableId}`);
  revalidatePath(`/loot-tables/${newId}`);

  return { ok: true, id: newId } as const;
}
