import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request,
  })

  // Check for Supabase session cookies
  const accessToken = request.cookies.get('sb-access-token')?.value
  const refreshToken = request.cookies.get('sb-refresh-token')?.value

  // Alternative cookie names (Supabase uses different formats)
  const hasSupabaseCookie = request.cookies.getAll().some(cookie =>
    cookie.name.includes('sb-') && cookie.name.includes('auth-token')
  )

  const isAuthenticated = !!(accessToken || refreshToken || hasSupabaseCookie)

  // Protected routes - redirect to sign-in if not authenticated
  if (!isAuthenticated && !request.nextUrl.pathname.startsWith('/auth')) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/auth/sign-in'
    redirectUrl.searchParams.set('redirectTo', request.nextUrl.pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // Redirect authenticated users away from auth pages
  if (isAuthenticated && request.nextUrl.pathname.startsWith('/auth/sign-')) {
    return NextResponse.redirect(new URL('/loot-tables', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
