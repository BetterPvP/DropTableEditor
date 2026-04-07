import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/supabase/types';

export type ItemRow = Database['public']['Tables']['items']['Row'];

export const DEFAULT_ITEMS_PAGE_SIZE = 100;

export interface ItemsQueryOptions {
  search?: string;
  searchMode?: 'contains' | 'regex';
  sortBy?: 'created_at' | 'id';
  sortDir?: 'asc' | 'desc';
}

export interface ItemsPageOptions extends ItemsQueryOptions {
  from?: number;
  limit?: number;
}

export interface ItemsPageResult {
  items: ItemRow[];
  count: number;
  from: number;
  to: number;
}

function escapeForIlike(value: string) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

export function createItemsQuery(
  client: SupabaseClient<Database>,
  { search, searchMode = 'contains', sortBy = 'created_at', sortDir = 'desc' }: ItemsQueryOptions = {},
) {
  let query = client
    .from('items')
    .select('*', { count: 'exact' })
    .order(sortBy, { ascending: sortDir === 'asc' });

  if (search && search.trim()) {
    const normalized = search.trim();

    if (searchMode === 'regex') {
      query = query.filter('id', 'imatch', normalized);
    } else {
      query = query.ilike('id', `%${escapeForIlike(normalized)}%`);
    }
  }

  return query;
}

export async function fetchItemsPage(
  client: SupabaseClient<Database>,
  { from = 0, limit = DEFAULT_ITEMS_PAGE_SIZE, ...options }: ItemsPageOptions = {},
): Promise<ItemsPageResult> {
  const to = from + Math.max(limit, 1) - 1;
  const { data, error, count } = await createItemsQuery(client, options).range(from, to);

  if (error) {
    throw error;
  }

  return {
    items: data ?? [],
    count: count ?? (data?.length ?? 0),
    from,
    to,
  };
}

export async function fetchAllItems(
  client: SupabaseClient<Database>,
  options: ItemsQueryOptions = {},
  pageSize: number = DEFAULT_ITEMS_PAGE_SIZE,
): Promise<ItemRow[]> {
  const items: ItemRow[] = [];
  let from = 0;
  let total: number | null = null;

  while (total === null || from < total) {
    const { items: pageItems, count } = await fetchItemsPage(client, { ...options, from, limit: pageSize });
    items.push(...pageItems);

    if (count != null) {
      total = count;
    }

    if (pageItems.length === 0) {
      break;
    }

    from += pageItems.length;
  }

  return items;
}
