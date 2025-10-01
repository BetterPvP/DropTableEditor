'use server';

import { z } from 'zod';
import { createServerSupabaseClient } from '@/supabase/server';

const inviteSchema = z.object({
  role: z.string().min(1),
  code: z.string().optional(),
});

const itemSchema = z.object({
  id: z.string().min(1),
});

function generateCode(prefix: string) {
  const random = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  return `${prefix}-${random}`;
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
