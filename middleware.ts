import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { Database } from './supabase/types';

const PUBLIC_PATHS = ['/', '/auth/sign-in', '/auth/sign-up'];

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.startsWith('/favicon')) {
    return response;
  }

  const supabase = createMiddlewareClient<Database>({ req: request, res: response });
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

  if (session && isAuthRoute) {
    const redirectUrl = new URL('/loot-tables', request.url);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
