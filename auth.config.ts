import type { NextAuthConfig } from 'next-auth';

/**
 * Edge-safe Auth.js config. Contains NO database or bcrypt access, so it can run
 * in the middleware (edge runtime). The full config in auth.ts spreads this and
 * adds the Credentials provider (which needs Node APIs).
 */
export const authConfig = {
  // Required when running behind Docker / a reverse proxy (non-Vercel hosts).
  trustHost: true,
  pages: {
    signIn: '/auth/sign-in',
  },
  session: { strategy: 'jwt' },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = Boolean(auth?.user);
      const path = nextUrl.pathname;
      const isAuthRoute = path.startsWith('/auth');
      const isPublic = path === '/' || isAuthRoute;

      if (isPublic) {
        // Bounce already-authenticated users off the auth pages (but allow the
        // password-reset page through).
        if (isLoggedIn && isAuthRoute && path !== '/auth/reset-password') {
          return Response.redirect(new URL('/loot-tables', nextUrl));
        }
        return true;
      }
      // Protected route → require a session (NextAuth redirects to signIn).
      return isLoggedIn;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role?: string }).role ?? 'editor';
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as 'editor' | 'admin') ?? 'editor';
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
