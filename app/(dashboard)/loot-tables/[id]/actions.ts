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

async function getAuthenticatedContext() {
  const supabase = createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id ?? null;

  if (!userId) {
    return { supabase, userId: null } as const;
  }

  return { supabase, userId } as const;
}

function revalidateLootTablePaths(tableId: string) {
  revalidatePath(`/loot-tables/${tableId}`);
  revalidatePath('/loot-tables');
}

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

  const { supabase, userId } = await getAuthenticatedContext();
  if (!userId) {
    return {
      ok: false,
      error: 'Not authenticated',
    } as const;
  }

  const timestamp = new Date().toISOString();
  const definitionPayload = {
    ...definition,
    id: tableId,
    updated_at: timestamp,
  };

  const { error } = await supabase
    .from('loot_tables')
    .update({
      name: definition.name,
      description: definition.description ?? null,
      updated_at: timestamp,
      updated_by: userId,
      definition: definitionPayload,
    })
    .eq('id', tableId);

  if (error) {
    console.error('Failed to persist loot table', error);
    return {
      ok: false,
      error: 'Unable to save loot table',
    } as const;
  }

  revalidateLootTablePaths(tableId);

  return {
    ok: true,
    version: definition.version,
    updated_at: timestamp,
  } as const;
}

export async function createSnapshotAction(tableId: string, label?: string) {
  if (!tableId) {
    return { ok: false, error: 'Missing loot table identifier.' } as const;
  }

  const { supabase, userId } = await getAuthenticatedContext();
  if (!userId) {
    return { ok: false, error: 'Not authenticated' } as const;
  }

  const { data: table, error: tableError } = await supabase
    .from('loot_tables')
    .select('id, name, description, version, definition')
    .eq('id', tableId)
    .maybeSingle();

  if (tableError || !table) {
    console.error('Failed to load loot table for snapshot', tableError);
    return { ok: false, error: 'Unable to find the requested loot table.' } as const;
  }

  const currentDefinition = lootTableDefinitionSchema.parse({
    ...(typeof table.definition === 'object' ? table.definition : {}),
    id: table.id,
    name: table.name,
    description: table.description ?? undefined,
    version: table.version,
  });

  const nextVersion = table.version + 1;
  const timestamp = new Date().toISOString();
  const nextDefinition = {
    ...currentDefinition,
    version: nextVersion,
    updated_at: timestamp,
  };

  const { error: snapshotError } = await supabase
    .from('loot_table_snapshots')
    .insert({
      loot_table_id: tableId,
      definition: currentDefinition,
      label: label ?? null,
      created_by: userId,
      created_at: timestamp,
    });

  if (snapshotError) {
    console.error('Failed to create snapshot', snapshotError);
    return { ok: false, error: 'Unable to create snapshot.' } as const;
  }

  const { error: updateError } = await supabase
    .from('loot_tables')
    .update({
      name: nextDefinition.name,
      description: nextDefinition.description ?? null,
      version: nextVersion,
      updated_at: timestamp,
      updated_by: userId,
      definition: nextDefinition,
    })
    .eq('id', tableId);

  if (updateError) {
    console.error('Failed to update loot table version after snapshot', updateError);
    return { ok: false, error: 'Unable to update loot table version.' } as const;
  }

  revalidateLootTablePaths(tableId);

  return {
    ok: true,
    version: nextVersion,
    updated_at: timestamp,
    definition: nextDefinition,
  } as const;
}

export async function listSnapshotsAction(tableId: string) {
  if (!tableId) {
    return { ok: false, error: 'Missing loot table identifier.' } as const;
  }

  const { supabase, userId } = await getAuthenticatedContext();
  if (!userId) {
    return { ok: false, error: 'Not authenticated' } as const;
  }

  const { data, error } = await supabase
    .from('loot_table_snapshots')
    .select('id, label, created_at, created_by')
    .eq('loot_table_id', tableId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to list snapshots', error);
    return { ok: false, error: 'Unable to list snapshots.' } as const;
  }

  return {
    ok: true,
    snapshots: data ?? [],
  } as const;
}

export async function restoreSnapshotAction(tableId: string, snapshotId: string) {
  if (!tableId || !snapshotId) {
    return { ok: false, error: 'Missing snapshot details.' } as const;
  }

  const { supabase, userId } = await getAuthenticatedContext();
  if (!userId) {
    return { ok: false, error: 'Not authenticated' } as const;
  }

  const [{ data: table, error: tableError }, { data: snapshot, error: snapshotError }] = await Promise.all([
    supabase
      .from('loot_tables')
      .select('id, version')
      .eq('id', tableId)
      .maybeSingle(),
    supabase
      .from('loot_table_snapshots')
      .select('definition')
      .eq('id', snapshotId)
      .eq('loot_table_id', tableId)
      .maybeSingle(),
  ]);

  if (tableError || !table) {
    console.error('Failed to load loot table for restore', tableError);
    return { ok: false, error: 'Unable to find the requested loot table.' } as const;
  }

  if (snapshotError || !snapshot) {
    console.error('Failed to load snapshot for restore', snapshotError);
    return { ok: false, error: 'Unable to find the requested snapshot.' } as const;
  }

  const timestamp = new Date().toISOString();
  const restoredDefinition = lootTableDefinitionSchema.parse({
    ...(typeof snapshot.definition === 'object' ? snapshot.definition : {}),
    id: tableId,
    version: table.version,
    updated_at: timestamp,
  });

  const { error } = await supabase
    .from('loot_tables')
    .update({
      name: restoredDefinition.name,
      description: restoredDefinition.description ?? null,
      updated_at: timestamp,
      updated_by: userId,
      definition: restoredDefinition,
    })
    .eq('id', tableId);

  if (error) {
    console.error('Failed to restore snapshot', error);
    return { ok: false, error: 'Unable to restore snapshot.' } as const;
  }

  revalidateLootTablePaths(tableId);

  return {
    ok: true,
    version: table.version,
    updated_at: timestamp,
    definition: restoredDefinition,
  } as const;
}
