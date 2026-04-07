'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { deleteItemsAction, registerItemsAction } from '@/app/(dashboard)/settings/actions';
import { createBrowserSupabaseClient } from '@/supabase/client';
import type { Database } from '@/supabase/types';
import { DEFAULT_ITEMS_PAGE_SIZE, fetchItemsPage } from '@/lib/items/queries';

interface ItemRegistryProps {
  initialItems: Database['public']['Tables']['items']['Row'][];
  initialTotalCount: number;
  pageSize?: number;
}

type ItemRow = Database['public']['Tables']['items']['Row'];
type SortOrder = 'id_asc' | 'id_desc' | 'date_asc' | 'date_desc';

const SORT_OPTIONS: Record<SortOrder, { label: string; sortBy: 'id' | 'created_at'; sortDir: 'asc' | 'desc' }> = {
  id_asc: { label: 'A-Z', sortBy: 'id', sortDir: 'asc' },
  id_desc: { label: 'Z-A', sortBy: 'id', sortDir: 'desc' },
  date_asc: { label: 'Oldest', sortBy: 'created_at', sortDir: 'asc' },
  date_desc: { label: 'Newest', sortBy: 'created_at', sortDir: 'desc' },
};

export function ItemRegistry({ initialItems, initialTotalCount, pageSize = DEFAULT_ITEMS_PAGE_SIZE }: ItemRegistryProps) {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const initialLoadRef = useRef(true);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const headerCheckboxRef = useRef<HTMLInputElement | null>(null);

  const [items, setItems] = useState<ItemRow[]>(initialItems);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [itemSearch, setItemSearch] = useState('');
  const [regexSearchEnabled, setRegexSearchEnabled] = useState(false);
  const [sortOrder, setSortOrder] = useState<SortOrder>('date_desc');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [registrationInput, setRegistrationInput] = useState('');
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [registerFeedback, setRegisterFeedback] = useState<string | null>(null);
  const [registeringItems, startRegisterItems] = useTransition();

  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteFeedback, setDeleteFeedback] = useState<string | null>(null);
  const [deletingItems, startDeletingItems] = useTransition();

  const [listError, setListError] = useState<string | null>(null);
  const [isLoadingPage, setIsLoadingPage] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialItems.length < initialTotalCount);

  const visibleIds = useMemo(() => items.map((item) => item.id), [items]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  const someVisibleSelected = !allVisibleSelected && visibleIds.some((id) => selectedIds.includes(id));
  const isEmpty = items.length === 0;
  const isSearching = itemSearch.trim().length > 0;

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = someVisibleSelected;
    }
  }, [someVisibleSelected]);

  useEffect(() => {
    setItems(initialItems);
    setTotalCount(initialTotalCount);
    setHasMore(initialItems.length < initialTotalCount);
  }, [initialItems, initialTotalCount]);

  const fetchPage = useCallback(
    async (from: number, search: string, nextSortOrder: SortOrder) =>
      fetchItemsPage(supabase, {
        from,
        limit: pageSize,
        search,
        searchMode: regexSearchEnabled ? 'regex' : 'contains',
        sortBy: SORT_OPTIONS[nextSortOrder].sortBy,
        sortDir: SORT_OPTIONS[nextSortOrder].sortDir,
      }),
    [pageSize, regexSearchEnabled, supabase],
  );

  const refreshList = useCallback(
    async (search: string, nextSortOrder: SortOrder) => {
      setIsLoadingPage(true);
      setListError(null);

      try {
        const { items: pageItems, count } = await fetchPage(0, search, nextSortOrder);
        setItems(pageItems);
        setTotalCount(count);
        setHasMore(pageItems.length < count);
      } catch (error) {
        console.error('Failed to load items', error);
        setItems([]);
        setTotalCount(0);
        setHasMore(false);
        const message =
          error instanceof Error && /regex|regular expression|invalid/i.test(error.message)
            ? 'Invalid regex pattern.'
            : 'Unable to load items.';
        setListError(message);
      } finally {
        setIsLoadingPage(false);
      }
    },
    [fetchPage],
  );

  const loadMoreItems = useCallback(async () => {
    if (isLoadingMore || isLoadingPage || !hasMore) {
      return;
    }

    setIsLoadingMore(true);
    setListError(null);
    const from = items.length;

    try {
      const { items: pageItems, count } = await fetchPage(from, itemSearch, sortOrder);
      setItems((previous) => [...previous, ...pageItems]);
      setTotalCount(count);
      setHasMore(from + pageItems.length < count);
    } catch (error) {
      console.error('Failed to load more items', error);
      setListError('Unable to load more items.');
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [fetchPage, hasMore, isLoadingMore, isLoadingPage, itemSearch, items.length, sortOrder]);

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

    return () => observer.disconnect();
  }, [hasMore, loadMoreItems]);

  useEffect(() => {
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      return;
    }

    const timeout = window.setTimeout(() => {
      void refreshList(itemSearch, sortOrder);
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [itemSearch, refreshList, regexSearchEnabled, sortOrder]);

  const handleSearchChange = (value: string) => {
    setItemSearch(value);
    setSelectedIds([]);
    setDeleteError(null);
    setDeleteFeedback(null);
  };

  const handleRegexToggle = (checked: boolean) => {
    setRegexSearchEnabled(checked);
    setSelectedIds([]);
    setDeleteError(null);
    setDeleteFeedback(null);
    setListError(null);
  };

  const toggleSelected = (id: string, checked: boolean) => {
    setSelectedIds((previous) =>
      checked ? Array.from(new Set([...previous, id])) : previous.filter((selectedId) => selectedId !== id),
    );
  };

  const toggleSelectAllVisible = (checked: boolean) => {
    setSelectedIds((previous) => {
      if (!checked) {
        return previous.filter((id) => !visibleIds.includes(id));
      }

      return Array.from(new Set([...previous, ...visibleIds]));
    });
  };

  const handleRegisterItems = async () => {
    setRegisterError(null);
    setRegisterFeedback(null);
    setDeleteError(null);
    setDeleteFeedback(null);

    const ids = Array.from(
      new Set(
        registrationInput
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean),
      ),
    );

    if (ids.length === 0) {
      setRegisterError('Paste at least one valid item ID.');
      return;
    }

    startRegisterItems(async () => {
      const response = await registerItemsAction(ids);
      if (!response.ok) {
        setRegisterError(response.error ?? 'Unable to register items.');
        setRegisterFeedback(`${response.registeredCount} registered / ${response.errorCount} errors`);
        return;
      }

      setRegisterFeedback(`${response.registeredCount} registered / ${response.errorCount} errors`);
      setRegistrationInput('');
      await refreshList(itemSearch, sortOrder);
      router.refresh();
    });
  };

  const handleDeleteItems = () => {
    if (selectedIds.length === 0) {
      return;
    }

    const confirmed = window.confirm(`Delete ${selectedIds.length} selected item${selectedIds.length === 1 ? '' : 's'}?`);
    if (!confirmed) {
      return;
    }

    setDeleteError(null);
    setDeleteFeedback(null);
    setRegisterError(null);
    setRegisterFeedback(null);

    startDeletingItems(async () => {
      const response = await deleteItemsAction(selectedIds);
      if (!response.ok) {
        setDeleteError(response.error ?? 'Unable to remove selected items.');
        return;
      }

      setDeleteFeedback(`Deleted ${response.deletedCount} item${response.deletedCount === 1 ? '' : 's'}.`);
      setSelectedIds([]);
      await refreshList(itemSearch, sortOrder);
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">Item Registry</h1>
          <p className="text-sm text-foreground/70">Manage registered item IDs for loot tables and simulations.</p>
        </div>
        <Button type="button" onClick={() => setRegistrationOpen((previous) => !previous)} className="gap-2">
          <Plus className="h-4 w-4" />
          + Register Items
        </Button>
      </div>

      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid gap-2 sm:max-w-sm">
              <Label htmlFor="item-search">Search</Label>
              <Input
                id="item-search"
                value={itemSearch}
                onChange={(event) => handleSearchChange(event.target.value)}
                placeholder={regexSearchEnabled ? 'Filter by regex pattern' : 'Filter by item ID'}
              />
              <label className="flex items-center gap-2 text-sm text-foreground/70">
                <input
                  type="checkbox"
                  checked={regexSearchEnabled}
                  onChange={(event) => handleRegexToggle(event.target.checked)}
                  aria-label="Enable regex search"
                  className="h-4 w-4 rounded border-white/20 bg-transparent text-primary focus:ring-ring"
                />
                Enable regex search
              </label>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="grid gap-2 sm:min-w-40">
                <Label htmlFor="sort-order">Sort</Label>
                <Select
                  value={sortOrder}
                  onValueChange={(value) => {
                    setSortOrder(value as SortOrder);
                    setSelectedIds([]);
                  }}
                >
                  <SelectTrigger id="sort-order">
                    <SelectValue placeholder="Sort items" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SORT_OPTIONS).map(([value, option]) => (
                      <SelectItem key={value} value={value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedIds.length > 0 && (
                <Button type="button" variant="destructive" onClick={handleDeleteItems} disabled={deletingItems} className="gap-2">
                  <Trash2 className="h-4 w-4" />
                  {deletingItems ? `Deleting ${selectedIds.length} items...` : `Delete ${selectedIds.length} items`}
                </Button>
              )}
            </div>
          </div>

          {registrationOpen && (
            <div className="rounded-md border bg-card p-4">
              <div className="mb-4">
                <CardTitle className="text-base">Register Items</CardTitle>
                <CardDescription>Paste item IDs one per line and register them in a single batch.</CardDescription>
              </div>
              <div className="grid gap-3">
                <Label htmlFor="item-registration-input">Paste item IDs (one per line)</Label>
                <Textarea
                  id="item-registration-input"
                  value={registrationInput}
                  onChange={(event) => setRegistrationInput(event.target.value)}
                  placeholder={'minecraft:diamond\nminecraft:emerald\nminecraft:netherite_ingot'}
                  className="min-h-40 font-mono text-sm"
                />
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="button" onClick={handleRegisterItems} disabled={registeringItems}>
                    {registeringItems ? 'Registering...' : 'Register All'}
                  </Button>
                  {registerError && <p className="text-sm text-destructive">{registerError}</p>}
                  {registerFeedback && <p className="text-sm text-primary">{registerFeedback}</p>}
                </div>
              </div>
            </div>
          )}

          {(deleteError || deleteFeedback || listError) && (
            <div className="space-y-1">
              {listError && <p className="text-sm text-destructive">{listError}</p>}
              {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
              {deleteFeedback && <p className="text-sm text-primary">{deleteFeedback}</p>}
            </div>
          )}
        </CardHeader>

        <CardContent>
          <div className="mb-3 text-sm text-foreground/60">
            {totalCount} registered item{totalCount === 1 ? '' : 's'} - Sorted by {SORT_OPTIONS[sortOrder].label}
          </div>
          <ScrollArea className="min-h-[24rem] rounded-md border bg-muted/25">
            <table className="w-full text-sm text-foreground/85">
              <thead className="sticky top-0 bg-background text-xs uppercase tracking-wide text-foreground/60">
                <tr>
                  <th className="w-12 px-4 py-3 text-left">
                    <input
                      ref={headerCheckboxRef}
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={(event) => toggleSelectAllVisible(event.target.checked)}
                      aria-label="Select all visible items"
                      className="h-4 w-4 rounded border-white/20 bg-transparent text-primary focus:ring-ring"
                    />
                  </th>
                  <th className="px-4 py-3 text-left">ID</th>
                  <th className="px-4 py-3 text-left">Registered date</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingPage && isEmpty ? (
                  <tr>
                    <td className="px-4 py-6 text-center text-foreground/60" colSpan={3}>
                      Loading items...
                    </td>
                  </tr>
                ) : isEmpty ? (
                  <tr>
                    <td className="px-4 py-6 text-center text-foreground/50" colSpan={3}>
                      {isSearching ? 'No items match that ID search.' : 'No items registered yet.'}
                    </td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const isSelected = selectedIds.includes(item.id);
                    return (
                      <tr key={item.id} className="border-t border-border/40">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(event) => toggleSelected(item.id, event.target.checked)}
                            aria-label={`Select ${item.id}`}
                            className="h-4 w-4 rounded border-white/20 bg-transparent text-primary focus:ring-ring"
                          />
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-white">{item.id}</td>
                        <td className="px-4 py-3 text-xs text-foreground/65">
                          {new Date(item.created_at).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })
                )}
                {isLoadingMore && !isEmpty && (
                  <tr>
                    <td className="px-4 py-4 text-center text-foreground/60" colSpan={3}>
                      Loading more items...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <div ref={loadMoreRef} className="h-4" />
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
