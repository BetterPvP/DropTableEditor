import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from './types';

export function createServerSupabaseClient() {
  return createServerComponentClient<Database>({ cookies });
}
