'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePathname, useRouter } from 'next/navigation';
import { ThemeProvider } from './theme-provider';
import { TransparencyProvider } from './transparency-provider';
import { createBrowserSupabaseClient } from '@/supabase/client';

function SupabaseAuthSync() {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createBrowserSupabaseClient();
  const inRecoveryFlow = useRef(false);

  // Reset recovery flag when the user leaves the reset-password page
  useEffect(() => {
    if (pathname !== '/auth/reset-password') {
      inRecoveryFlow.current = false;
    }
  }, [pathname]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'INITIAL_SESSION') {
        return;
      }
      try {
        await fetch('/auth/callback', {
          method: 'POST',
          headers: new Headers({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ event, session }),
        });
      } catch (error) {
        console.error('Failed to persist auth state', error);
      }

      if (event === 'PASSWORD_RECOVERY') {
        inRecoveryFlow.current = true;
        router.replace('/auth/reset-password');
        return;
      }

      // Suppress router.refresh() during recovery to prevent the middleware from
      // redirecting the user away from /auth/reset-password while navigating there.
      if (inRecoveryFlow.current) {
        return;
      }

      router.refresh();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router, supabase]);

  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
        <TransparencyProvider>
          <SupabaseAuthSync />
          {children}
        </TransparencyProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
