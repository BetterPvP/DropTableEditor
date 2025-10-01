import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
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

  const supabase = createRouteHandlerClient<Database>({ cookies });
  const code = parsed.data.code.trim().toUpperCase();
  const { data: invite, error } = await supabase
    .from('invite_codes')
    .select('*')
    .eq('code', code)
    .maybeSingle();

  if (error) {
    console.error('Failed to read invite code', error);
    return NextResponse.json({ error: 'Unable to redeem code' }, { status: 500 });
  }

  if (!invite) {
    return NextResponse.json({ error: 'Invite code not found' }, { status: 404 });
  }

  if (invite.used_at || invite.used_by) {
    return NextResponse.json({ error: 'Invite code already used' }, { status: 409 });
  }

  const { error: updateError } = await supabase
    .from('invite_codes')
    .update({ used_at: new Date().toISOString(), used_by: parsed.data.userId })
    .eq('code', code);

  if (updateError) {
    console.error('Failed to mark invite code as used', updateError);
    return NextResponse.json({ error: 'Unable to mark invite as used' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
