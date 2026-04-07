'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/supabase/server';
import { lootTableDefinitionSchema } from '@/lib/loot-tables/types';

const payloadSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

export async function createLootTableAction(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const parsed = payloadSchema.safeParse({
    name: raw.name,
    description: raw.description,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().fieldErrors.name?.[0] ?? 'Invalid payload' } as const;
  }

  const supabase = createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id ?? null;

  if (!userId) {
    return { ok: false, error: 'Not authenticated' } as const;
  }

  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const definition = lootTableDefinitionSchema.parse({
    id,
    name: parsed.data.name,
    description: parsed.data.description ?? undefined,
    notes: '',
    replacementStrategy: 'UNSET',
    rollStrategy: { type: 'CONSTANT', rolls: 1 },
    weightDistribution: 'STATIC',
    pityRules: [],
    progressive: undefined,
    awardStrategy: { type: 'DEFAULT' },
    entries: [],
    guaranteed: [],
    version: 1,
    updated_at: timestamp,
  });

  const { error } = await supabase.from('loot_tables').insert({
    id,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    created_by: userId,
    updated_by: userId,
    created_at: timestamp,
    updated_at: timestamp,
    version: 1,
    definition,
  });

  if (error) {
    console.error('Failed to create loot table', error);
    return { ok: false, error: 'Unable to create loot table' } as const;
  }

  redirect(`/loot-tables/${id}`);
}
