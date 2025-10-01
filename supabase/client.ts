'use client';

import { createBrowserSupabaseClient as createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { SupabaseClient } from '@supabase/supabase-js';

import { Database } from './types';

let browserClient: SupabaseClient<Database> | undefined;

export function createBrowserSupabaseClient() {
  if (!browserClient) {
    browserClient = createClientComponentClient<Database>();
  }
  return browserClient;
}
