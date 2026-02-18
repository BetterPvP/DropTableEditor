import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { EmailOtpType } from '@supabase/supabase-js';
import { Database } from '@/supabase/types';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const next = searchParams.get('next') ?? '/auth/reset-password';

  if (token_hash && type) {
    // Use a no-op cookie store — we don't need to persist the session server-side.
    // Instead we pass the tokens to the browser via the URL hash so that
    // createBrowserClient (detectSessionInUrl: true) can establish the session
    // client-side. This avoids the cookie-format mismatch between createServerClient
    // and createBrowserClient.
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll(); },
          setAll() { /* intentional no-op */ },
        },
      }
    );

    const { data, error } = await supabase.auth.verifyOtp({
      type: type as EmailOtpType,
      token_hash,
    });

    if (!error && data.session) {
      const { access_token, refresh_token } = data.session;
      const hash = [
        `access_token=${encodeURIComponent(access_token)}`,
        `refresh_token=${encodeURIComponent(refresh_token)}`,
        `token_type=bearer`,
        `type=${encodeURIComponent(type)}`,
      ].join('&');
      return NextResponse.redirect(
        new URL(`${next}?access_token=${access_token}&refresh_token=${refresh_token}&type=${type}`, origin)
      );
    }
  }

  return NextResponse.redirect(new URL('/auth/sign-in?error=invalid-reset-link', origin));
}
