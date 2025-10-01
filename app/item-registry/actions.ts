'use server';

import { z } from 'zod';
import { createServerSupabaseClient } from '@/supabase/server';

const itemSchema = z.object({
  id: z.string().min(1),
});

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
