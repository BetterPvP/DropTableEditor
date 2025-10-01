'use client';

import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import { Database } from './types';

export function createBrowserSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Supabase environment variables are not configured.');
  }
  return createBrowserClient<Database>(url, key);
}
