import { Metadata } from 'next';
import { ItemRegistry } from '@/components/settings/item-registry';
import { createServerSupabaseClient } from '@/supabase/server';

export const metadata: Metadata = {
  title: 'Item Registry | BetterPvP Admin Console',
};

export const dynamic = 'force-dynamic';

export default async function ItemRegistryPage() {
  const supabase = createServerSupabaseClient();
  const [{ data: auth }, { data: items }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('items').select('*').order('created_at', { ascending: false }),
  ]);

  if (!auth.user) {
    return null;
  }

  return <ItemRegistry items={items ?? []} />;
}
