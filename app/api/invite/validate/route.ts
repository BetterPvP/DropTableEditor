import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { z } from 'zod';
import { Database } from '@/supabase/types';

const schema = z.object({
  code: z.string().min(4),
  email: z.string().email(),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const supabase = createRouteHandlerClient<Database>({ cookies });
  const code = parsed.data.code.trim().toUpperCase();
  const { data: invite, error } = await supabase
    .from('invite_codes')
    .select('*')
    .eq('code', code)
    .maybeSingle();

  if (error) {
    console.error('Failed to lookup invite code', error);
    return NextResponse.json({ error: 'Unable to verify invite code' }, { status: 500 });
  }

  if (!invite) {
    return NextResponse.json({ error: 'Invite code not recognised' }, { status: 403 });
  }

  if (invite.used_at || invite.used_by) {
    return NextResponse.json({ error: 'Invite code already used' }, { status: 409 });
  }

  return NextResponse.json({ ok: true, role: invite.role ?? 'admin' });
}
