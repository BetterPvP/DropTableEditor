import { Metadata } from 'next';
import { ItemRegistry } from '@/components/items/registry';
import { createServerSupabaseClient } from '@/supabase/server';
import { DEFAULT_ITEMS_PAGE_SIZE, fetchItemsPage } from '@/lib/items/queries';

export const metadata: Metadata = {
  title: 'Item Registry | BetterPvP Admin Console',
};

export const dynamic = 'force-dynamic';

export default async function ItemRegistryPage() {
  const supabase = createServerSupabaseClient();

  try {
    const { items, count } = await fetchItemsPage(supabase, { limit: DEFAULT_ITEMS_PAGE_SIZE });

    return (
      <ItemRegistry initialItems={items} initialTotalCount={count} pageSize={DEFAULT_ITEMS_PAGE_SIZE} />
    );
  } catch (error) {
    console.error('Failed to load item registry', error);
    return <ItemRegistry initialItems={[]} initialTotalCount={0} pageSize={DEFAULT_ITEMS_PAGE_SIZE} />;
  }
}
