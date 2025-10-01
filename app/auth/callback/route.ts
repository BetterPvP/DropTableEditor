import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/supabase/server';

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const { event, session } = await request.json();

  if (session && ['SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED'].includes(event)) {
    await supabase.auth.setSession(session);
  }

  if (event === 'SIGNED_OUT') {
    await supabase.auth.signOut();
  }

  return NextResponse.json({ success: true });
}
