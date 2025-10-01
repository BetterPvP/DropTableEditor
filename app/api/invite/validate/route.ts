import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
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

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const code = parsed.data.code.trim().toUpperCase();
  const { data, error } = await supabase.rpc('check_invite_code', { code });
  if (error) {
    console.error('Failed to check invite code', error);
    return NextResponse.json({ error: 'Unable to vePrify invite code' }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'Invite code not recognised' }, { status: 403 });
  }

  return NextResponse.json({ ok: true, role: data[0].role ?? 'admin' });
}
