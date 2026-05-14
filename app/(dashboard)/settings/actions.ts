'use server';

import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { applyItemRenamesToDefinition, parseLootTableDefinitionForRename, validateItemRenames } from '@/lib/items/rename';
import { fetchAllItems } from '@/lib/items/queries';
import { createServerSupabaseClient } from '@/supabase/server';

const inviteSchema = z.object({
  role: z.string().min(1),
  code: z.string().optional(),
});

const itemSchema = z.object({
  id: z.string().min(1),
});
const itemsSchema = z.array(z.string().trim().min(1)).min(1);
const renameItemSchema = z.object({
  from: z.string().trim().min(1),
  to: z.string().trim().min(1),
});
const renameItemsSchema = z.array(renameItemSchema).min(1);

function generateCode(prefix: string) {
  const random = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  return `${prefix}-${random}`;
}

function revalidateRenamePaths(tableIds: string[]) {
  revalidatePath('/item-registry');
  revalidatePath('/loot-tables');

  for (const tableId of tableIds) {
    revalidatePath(`/loot-tables/${tableId}`);
    revalidatePath(`/loot-tables/${tableId}/simulate`);
  }
}

async function renameItemsAndPropagate(renames: { from: string; to: string }[]) {
  const supabase = createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id ?? null;

  if (!userId) {
    return { ok: false, error: 'Not authenticated', renamedCount: 0, updatedTableCount: 0 } as const;
  }

  const normalizedRenames = renames.map((rename) => ({
    from: rename.from.trim(),
    to: rename.to.trim(),
  }));

  let items;
  try {
    items = await fetchAllItems(supabase, { sortBy: 'id', sortDir: 'asc' });
  } catch (itemsError) {
    console.error('Failed to load items for rename', itemsError);
    return { ok: false, error: 'Unable to load items for rename.', renamedCount: 0, updatedTableCount: 0 } as const;
  }

  const { data: lootTables, error: lootTablesError } = await supabase
    .from('loot_tables')
    .select('id, name, description, version, definition');

  if (lootTablesError) {
    console.error('Failed to load loot tables for rename propagation', lootTablesError);
    return { ok: false, error: 'Unable to load loot tables for rename propagation.', renamedCount: 0, updatedTableCount: 0 } as const;
  }

  const existingIds = items.map((item) => item.id);
  const validation = validateItemRenames(existingIds, normalizedRenames);
  if (!validation.ok) {
    return { ok: false, error: validation.error, renamedCount: 0, updatedTableCount: 0 } as const;
  }

  if (validation.renames.length === 0) {
    return { ok: true, renamedCount: 0, updatedTableCount: 0 } as const;
  }

  const itemsById = new Map(items.map((item) => [item.id, item]));
  for (const rename of validation.renames) {
    if (!itemsById.has(rename.from)) {
      return {
        ok: false,
        error: `Unable to find item ${rename.from}.`,
        renamedCount: 0,
        updatedTableCount: 0,
      } as const;
    }
  }

  const tempIdBySource = new Map(
    validation.renames.map((rename) => [rename.from, `__rename__${randomUUID()}__${rename.from}`]),
  );

  for (const rename of validation.renames) {
    const sourceItem = itemsById.get(rename.from);
    const tempId = tempIdBySource.get(rename.from);

    if (!sourceItem || !tempId) {
      return { ok: false, error: 'Unable to prepare item rename.', renamedCount: 0, updatedTableCount: 0 } as const;
    }

    const { error } = await supabase
      .from('items')
      .update({
        id: tempId,
        name: sourceItem.name === rename.from ? tempId : sourceItem.name,
      })
      .eq('id', rename.from);

    if (error) {
      console.error('Failed to stage item rename', error);
      return { ok: false, error: 'Unable to stage item rename.', renamedCount: 0, updatedTableCount: 0 } as const;
    }
  }

  for (const rename of validation.renames) {
    const sourceItem = itemsById.get(rename.from);
    const tempId = tempIdBySource.get(rename.from);

    if (!sourceItem || !tempId) {
      return { ok: false, error: 'Unable to finalize item rename.', renamedCount: 0, updatedTableCount: 0 } as const;
    }

    const { error } = await supabase
      .from('items')
      .update({
        id: rename.to,
        name: sourceItem.name === rename.from ? rename.to : sourceItem.name,
      })
      .eq('id', tempId);

    if (error) {
      console.error('Failed to finalize item rename', error);
      return { ok: false, error: 'Unable to finalize item rename.', renamedCount: 0, updatedTableCount: 0 } as const;
    }
  }

  const timestamp = new Date().toISOString();
  const changedTableIds: string[] = [];

  for (const table of lootTables ?? []) {
    const parsedDefinition = parseLootTableDefinitionForRename(table.definition, {
      id: table.id,
      name: table.name,
      description: table.description ?? undefined,
      version: table.version,
      updated_at: timestamp,
    });

    const nextDefinition = applyItemRenamesToDefinition(parsedDefinition, validation.renames);
    if (nextDefinition === parsedDefinition) {
      continue;
    }

    const { error } = await supabase
      .from('loot_tables')
      .update({
        name: nextDefinition.name,
        description: nextDefinition.description ?? null,
        updated_at: timestamp,
        updated_by: userId,
        definition: {
          ...nextDefinition,
          updated_at: timestamp,
        },
      })
      .eq('id', table.id);

    if (error) {
      console.error('Failed to propagate item rename to loot table', error);
      return {
        ok: false,
        error: `Unable to propagate renamed items to loot table ${table.name}.`,
        renamedCount: 0,
        updatedTableCount: changedTableIds.length,
      } as const;
    }

    changedTableIds.push(table.id);
  }

  revalidateRenamePaths(changedTableIds);

  return {
    ok: true,
    renamedCount: validation.renames.length,
    updatedTableCount: changedTableIds.length,
  } as const;
}

export async function createInviteCodeAction(formData: FormData) {
  const parsed = inviteSchema.safeParse({
    role: formData.get('role'),
    code: formData.get('code'),
  });
  if (!parsed.success) {
    return { ok: false, error: 'Role is required' } as const;
  }

  const supabase = createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id ?? null;

  if (!userId) {
    return { ok: false, error: 'Not authenticated' } as const;
  }

  const prefix = parsed.data.role.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'ADMIN';
  let code = (parsed.data.code as string | undefined)?.toUpperCase().replace(/\s+/g, '-');
  if (!code) {
    code = generateCode(prefix);
  }

  const { data: existing } = await supabase
    .from('invite_codes')
    .select('code')
    .eq('code', code)
    .maybeSingle();
  if (existing) {
    return { ok: false, error: 'Invite code already exists. Provide a different code or leave it blank.' } as const;
  }

  const { error } = await supabase.from('invite_codes').insert({
    code,
    role: parsed.data.role,
    created_by: userId,
  });

  if (error) {
    console.error('Failed to create invite code', error);
    return { ok: false, error: 'Unable to create invite code' } as const;
  }

  return { ok: true, code } as const;
}

export async function registerItemAction(formData: FormData) {
  const parsed = itemSchema.safeParse({
    id: formData.get('id'),
  });
  if (!parsed.success) {
    return { ok: false, error: 'Item ID is required' } as const;
  }

  const supabase = createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id ?? null;

  if (!userId) {
    return { ok: false, error: 'Not authenticated' } as const;
  }

  const { error } = await supabase.from('items').insert({
    id: parsed.data.id,
    name: parsed.data.id,
    description: null,
    tags: null,
  });

  if (error) {
    console.error('Failed to register item', error);
    return { ok: false, error: 'Unable to register item. Ensure the ID is unique.' } as const;
  }

  return { ok: true } as const;
}

export async function registerItemsAction(ids: string[]) {
  const parsed = itemsSchema.safeParse(ids);
  if (!parsed.success) {
    return { ok: false, error: 'At least one valid item ID is required', registeredCount: 0, errorCount: ids.length } as const;
  }

  const uniqueIds = Array.from(new Set(parsed.data.map((id) => id.trim()).filter(Boolean)));
  const supabase = createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id ?? null;

  if (!userId) {
    return { ok: false, error: 'Not authenticated', registeredCount: 0, errorCount: uniqueIds.length } as const;
  }

  const { error } = await supabase
    .from('items')
    .upsert(
      uniqueIds.map((id) => ({
        id,
        name: id,
      })),
      { onConflict: 'id', ignoreDuplicates: true },
    );

  if (error) {
    console.error('Failed to register items', error);
    return { ok: false, error: 'Unable to register items', registeredCount: 0, errorCount: uniqueIds.length } as const;
  }

  return { ok: true, registeredCount: uniqueIds.length, errorCount: 0 } as const;
}

export async function deleteItemAction(formData: FormData) {
  const parsed = itemSchema.safeParse({
    id: formData.get('id'),
  });
  if (!parsed.success) {
    return { ok: false, error: 'Item ID is required' } as const;
  }

  const supabase = createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id ?? null;

  if (!userId) {
    return { ok: false, error: 'Not authenticated' } as const;
  }

  const { error } = await supabase.from('items').delete().eq('id', parsed.data.id);

  if (error) {
    console.error('Failed to delete item', error);
    return { ok: false, error: 'Unable to remove item' } as const;
  }

  return { ok: true } as const;
}

export async function deleteItemsAction(ids: string[]) {
  const parsed = itemsSchema.safeParse(ids);
  if (!parsed.success) {
    return { ok: false, error: 'At least one item ID is required', deletedCount: 0 } as const;
  }

  const uniqueIds = Array.from(new Set(parsed.data.map((id) => id.trim()).filter(Boolean)));
  const supabase = createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id ?? null;

  if (!userId) {
    return { ok: false, error: 'Not authenticated', deletedCount: 0 } as const;
  }

  const { error } = await supabase.from('items').delete().in('id', uniqueIds);

  if (error) {
    console.error('Failed to delete items', error);
    return { ok: false, error: 'Unable to remove selected items', deletedCount: 0 } as const;
  }

  return { ok: true, deletedCount: uniqueIds.length } as const;
}

export async function renameItemAction(rename: { from: string; to: string }) {
  const parsed = renameItemSchema.safeParse(rename);
  if (!parsed.success) {
    return { ok: false, error: 'Both the current and new item IDs are required.', renamedCount: 0, updatedTableCount: 0 } as const;
  }

  return renameItemsAndPropagate([parsed.data]);
}

export async function renameItemsAction(renames: { from: string; to: string }[]) {
  const parsed = renameItemsSchema.safeParse(renames);
  if (!parsed.success) {
    return { ok: false, error: 'At least one valid rename is required.', renamedCount: 0, updatedTableCount: 0 } as const;
  }

  return renameItemsAndPropagate(parsed.data);
}
