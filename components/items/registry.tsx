'use client';

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Database } from '@/supabase/types';
import { deleteItemAction, registerItemAction } from '@/app/settings/actions';
import { createBrowserSupabaseClient } from '@/supabase/client';
import { DEFAULT_ITEMS_PAGE_SIZE } from '@/lib/items/queries';

interface ItemRegistryProps {
  initialItems: Database['public']['Tables']['items']['Row'][];
  initialTotalCount: number;
  pageSize?: number;
}

type ItemRow = Database['public']['Tables']['items']['Row'];

export function ItemRegistry({ initialItems, initialTotalCount, pageSize = DEFAULT_ITEMS_PAGE_SIZE }: ItemRegistryProps) {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);

  const [items, setItems] = useState<ItemRow[]>(initialItems);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [itemId, setItemId] = useState('');
  const [itemError, setItemError] = useState<string | null>(null);
  const [itemFeedback, setItemFeedback] = useState<string | null>(null);
  const [registeringItem, startRegisterItem] = useTransition();

  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteFeedback, setDeleteFeedback] = useState<string | null>(null);
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);
  const [removingItem, startRemoveItem] = useTransition();

  const [itemSearch, setItemSearch] = useState('');
  const [listError, setListError] = useState<string | null>(null);
  const [isLoadingPage, setIsLoadingPage] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialItems.length < initialTotalCount);

  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    setItems(initialItems);
    setTotalCount(initialTotalCount);
    setHasMore(initialItems.length < initialTotalCount);
  }, [initialItems, initialTotalCount]);

  const fetchPage = useCallback(
    async (from: number, search: string) => {
      const rangeEnd = from + Math.max(pageSize, 1) - 1;
      let query = supabase
        .from('items')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, rangeEnd);

      const trimmed = search.trim();
      if (trimmed) {
        const normalized = trimmed.replace(/[\\%_]/g, (match) => `\\${match}`);
        query = query.or(`id.ilike.%${normalized}%,name.ilike.%${normalized}%`);
      }

      const { data, error, count } = await query;
      if (error) {
        throw error;
      }

      return {
        items: (data ?? []) as ItemRow[],
        count: typeof count === 'number' ? count : null,
      };
    },
    [pageSize, supabase],
  );

  const refreshList = useCallback(
    async (search: string) => {
      setIsLoadingPage(true);
      setListError(null);
      try {
        const { items: pageItems, count } = await fetchPage(0, search);
        const total = typeof count === 'number' ? count : null;
        setItems(pageItems);
        setTotalCount(total ?? pageItems.length);
        setHasMore(pageItems.length === pageSize && (total === null || pageItems.length < total));
      } catch (error) {
        console.error('Failed to load items', error);
        setItems([]);
        setTotalCount(0);
        setHasMore(false);
        setListError('Unable to load items.');
      } finally {
        setIsLoadingPage(false);
      }
    },
    [fetchPage, pageSize],
  );

  const loadMoreItems = useCallback(async () => {
    if (isLoadingMore || isLoadingPage || !hasMore) {
      return;
    }

    setIsLoadingMore(true);
    setListError(null);
    const from = items.length;

    try {
      const { items: pageItems, count } = await fetchPage(from, itemSearch);
      setItems((previous) => [...previous, ...pageItems]);
      if (typeof count === 'number') {
        setTotalCount(count);
        if (from + pageItems.length >= count) {
          setHasMore(false);
        }
      } else {
        setTotalCount((previous) => previous + pageItems.length);
        if (pageItems.length < pageSize) {
          setHasMore(false);
        }
      }
    } catch (error) {
      console.error('Failed to load more items', error);
      setListError('Unable to load more items.');
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [fetchPage, hasMore, isLoadingMore, isLoadingPage, itemSearch, items.length, pageSize]);

  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    const target = loadMoreRef.current;
    if (!target || !hasMore) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadMoreItems();
        }
      },
      { rootMargin: '200px' },
    );

    observer.observe(target);
    observerRef.current = observer;

    return () => {
      observer.disconnect();
    };
  }, [hasMore, loadMoreItems]);

  useEffect(() => {
    if (itemSearch.trim()) {
      const timeout = window.setTimeout(() => {
        void refreshList(itemSearch);
      }, 300);
      return () => window.clearTimeout(timeout);
    }

    setItems(initialItems);
    setTotalCount(initialTotalCount);
    setHasMore(initialItems.length < initialTotalCount);
    setListError(null);
  }, [initialItems, initialTotalCount, itemSearch, refreshList]);

  const handleRegisterItem = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setItemError(null);
    setItemFeedback(null);
    const formData = new FormData();
    formData.append('id', itemId.trim());

    startRegisterItem(async () => {
      const response = await registerItemAction(formData);
      if (response && !response.ok) {
        setItemError(response.error ?? 'Unable to register item');
        return;
      }
      setItemFeedback(`Item ${itemId.trim()} registered.`);
      setDeleteFeedback(null);
      setItemId('');
      router.refresh();
    });
  };

  const handleDeleteItem = (id: string) => {
    setDeleteError(null);
    setDeleteFeedback(null);
    setItemFeedback(null);
    const formData = new FormData();
    formData.append('id', id);
    setRemovingItemId(id);

    startRemoveItem(async () => {
      const response = await deleteItemAction(formData);
      if (response && !response.ok) {
        setDeleteError(response.error ?? 'Unable to remove item');
        setRemovingItemId(null);
        return;
      }
      setDeleteFeedback(`Item ${id} removed.`);
      setRemovingItemId(null);
      router.refresh();
    });
  };

  const isEmpty = items.length === 0;
  const isSearching = itemSearch.trim().length > 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-white">Item registry</h1>
        <p className="text-sm text-foreground/70">
          Register loot items for use in drop tables or remove entries that are no longer needed.
        </p>
      </div>
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Registered items</CardTitle>
            <CardDescription>Items listed here can be referenced by loot tables and simulations.</CardDescription>
          </div>
          <Badge variant="default">{totalCount} items</Badge>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <form className="space-y-4 rounded-2xl border border-white/10 bg-black/40 p-4" onSubmit={handleRegisterItem}>
            <div className="space-y-2">
              <Label htmlFor="item-id">Item ID</Label>
              <Input
                id="item-id"
                value={itemId}
                onChange={(event) => setItemId(event.target.value)}
                placeholder="minecraft:diamond"
                required
              />
              <p className="text-xs text-foreground/50">
                Only the canonical item identifier is stored. Display metadata is resolved in-game.
              </p>
            </div>
            <Button type="submit" disabled={registeringItem}>
              {registeringItem ? 'Registering…' : 'Register item'}
            </Button>
            {itemError && <p className="text-sm text-destructive">{itemError}</p>}
            {itemFeedback && <p className="text-sm text-primary">{itemFeedback}</p>}
          </form>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="item-search">Search</Label>
              <Input
                id="item-search"
                value={itemSearch}
                onChange={(event) => setItemSearch(event.target.value)}
                placeholder="Search registered items..."
              />
            </div>
            {listError && <p className="text-sm text-destructive">{listError}</p>}
            <ScrollArea className="min-h-[20rem] max-h-[32rem] rounded-2xl border border-white/10 bg-black/30">
              <table className="w-full text-sm text-foreground/80">
                <thead className="sticky top-0 bg-black/60 text-xs uppercase tracking-wide text-foreground/60">
                  <tr>
                    <th className="px-4 py-2 text-left">ID</th>
                    <th className="px-4 py-2 text-left">Registered</th>
                    <th className="px-4 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingPage && isEmpty ? (
                    <tr>
                      <td className="px-4 py-4 text-center text-foreground/60" colSpan={3}>
                        Loading items…
                      </td>
                    </tr>
                  ) : isEmpty ? (
                    <tr>
                      <td className="px-4 py-4 text-center text-foreground/50" colSpan={3}>
                        {isSearching
                          ? 'No items match your search.'
                          : 'No items registered yet. Add at least one to start building loot tables.'}
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => (
                      <tr key={item.id} className="border-b border-white/5">
                        <td className="px-4 py-2 font-mono text-xs">{item.id}</td>
                        <td className="px-4 py-2 text-xs text-foreground/60">
                          Added {new Date(item.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-xs">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="gap-2 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteItem(item.id)}
                            disabled={removingItem && removingItemId === item.id}
                          >
                            <Trash2 className="h-4 w-4" />
                            {removingItem && removingItemId === item.id ? 'Removing…' : 'Delete'}
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                  {isLoadingMore && !isEmpty && (
                    <tr>
                      <td className="px-4 py-4 text-center text-foreground/60" colSpan={3}>
                        Loading more items…
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <div ref={loadMoreRef} className="h-4" />
            </ScrollArea>
          </div>

          {(deleteError || deleteFeedback) && (
            <div className="lg:col-span-2">
              {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
              {deleteFeedback && <p className="text-sm text-primary">{deleteFeedback}</p>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
