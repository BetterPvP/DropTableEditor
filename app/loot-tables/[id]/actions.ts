'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/supabase/server';
import {
  lootTableDefinitionSchema,
  LootTableDefinition,
} from '@/lib/loot-tables/types';

const payloadSchema = lootTableDefinitionSchema.extend({
  version: z.number().int().nonnegative(),
});

export async function saveLootTableAction({
  tableId,
  definition,
}: {
  tableId: string;
  definition: LootTableDefinition;
}) {
  const parsed = payloadSchema.safeParse({ ...definition, id: tableId });
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Invalid payload',
      issues: parsed.error.flatten(),
    } as const;
  }

  const supabase = createServerSupabaseClient();
  const expectedVersion = definition.version;
  const nextVersion = expectedVersion + 1;
  const timestamp = new Date().toISOString();

  const { data, error } = await supabase
    .from('loot_tables')
    .update({
      name: definition.name,
      description: definition.description ?? null,
      updated_at: timestamp,
      updated_by: null,
      version: nextVersion,
      definition: {
        ...definition,
        version: nextVersion,
        updated_at: timestamp,
      },
    })
    .eq('id', tableId)
    .eq('version', expectedVersion)
    .select('version');

  if (error) {
    console.error('Failed to persist loot table', error);
    return {
      ok: false,
      error: 'Unable to save loot table',
    } as const;
  }

  if (!data || data.length === 0) {
    return {
      ok: false,
      error: 'Version conflict detected. Please refresh to load the latest changes.',
      conflict: true,
    } as const;
  }

  revalidatePath(`/loot-tables/${tableId}`);
  revalidatePath('/loot-tables');

  return {
    ok: true,
    version: nextVersion,
    updated_at: timestamp,
  } as const;
}
