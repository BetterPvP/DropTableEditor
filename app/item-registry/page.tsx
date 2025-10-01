import { Metadata } from 'next';
import { ItemRegistry } from '@/components/items/registry';
import { createServerSupabaseClient } from '@/supabase/server';

export const metadata: Metadata = {
  title: 'Item Registry | BetterPvP Admin Console',
};

export const dynamic = 'force-dynamic';

export default async function ItemRegistryPage() {
  const supabase = createServerSupabaseClient();
  const { data: items } = await supabase.from('items').select('*').order('created_at', { ascending: false });

  return <ItemRegistry items={items ?? []} />;
}
