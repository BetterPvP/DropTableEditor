import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { Database } from './supabase/types';

const PUBLIC_PATHS = [
  '/auth/sign-in',
  '/auth/sign-up',
  '/auth/reset-password'
];

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.startsWith('/favicon')) {
    return response;
  }

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const isAuthRoute = pathname.startsWith('/auth');
  const isPublicRoute = PUBLIC_PATHS.includes(pathname);

  if (!session && !isPublicRoute && !isAuthRoute) {
    const redirectUrl = new URL('/auth/sign-in', request.url);
    if (pathname !== '/') {
      redirectUrl.searchParams.set('redirectTo', `${pathname}${search}`);
    }
    return NextResponse.redirect(redirectUrl);
  }

  const UNREDIRECTABLE_AUTH_PATHS = ['/auth/reset-password', '/auth/confirm'];
  if (session && isAuthRoute && !UNREDIRECTABLE_AUTH_PATHS.includes(pathname)) {
    return NextResponse.redirect(new URL('/loot-tables', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
