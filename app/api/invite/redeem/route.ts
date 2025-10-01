import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { Database } from '@/supabase/types';

const schema = z.object({
  code: z.string().min(4),
  userId: z.string().uuid(),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  // Service role client: bypasses RLS
  const admin = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,  // project url (public is fine)
    process.env.SUPABASE_SERVICE_ROLE_KEY!  // server-only secret
  );

  const code = parsed.data.code.trim().toUpperCase();

  // Update only if not already used
  const { error: updateError } = await admin
    .from('invite_codes')
    .update({ used_at: new Date().toISOString(), used_by: parsed.data.userId })
    .eq('code', code)
    .is('used_at', null)
    .is('used_by', null);

  if (updateError) {
    console.error('Failed to mark invite code as used', updateError);
    return NextResponse.json({ error: 'Unable to mark invite as used' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
