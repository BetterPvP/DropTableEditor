import NextAuth from 'next-auth';
import { authConfig } from './auth.config';

// Edge-safe auth middleware. Route protection is decided by the `authorized`
// callback in auth.config.ts. The Credentials provider (Node-only) is NOT
// loaded here.
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  // Run on everything except Next internals and the Auth.js API routes.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
