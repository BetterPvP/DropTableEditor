'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { ThemeProvider } from './theme-provider';
import { TransparencyProvider } from './transparency-provider';
import { createBrowserSupabaseClient } from '@/supabase/client';

function SupabaseAuthSync() {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();

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
