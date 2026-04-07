'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { deleteItemsAction, registerItemsAction, renameItemAction, renameItemsAction } from '@/app/(dashboard)/settings/actions';
import { previewRegexRename, validateItemRenames } from '@/lib/items/rename';
import { createBrowserSupabaseClient } from '@/supabase/client';
import type { Database } from '@/supabase/types';
import { DEFAULT_ITEMS_PAGE_SIZE, fetchAllItems, fetchItemsPage } from '@/lib/items/queries';

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

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [singleRenameValue, setSingleRenameValue] = useState('');
  const [regexReplaceValue, setRegexReplaceValue] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [renameFeedback, setRenameFeedback] = useState<string | null>(null);
  const [renamingItems, startRenamingItems] = useTransition();
  const [allItemIds, setAllItemIds] = useState<string[]>(() => initialItems.map((item) => item.id));

  const [listError, setListError] = useState<string | null>(null);
  const [isLoadingPage, setIsLoadingPage] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialItems.length < initialTotalCount);

  const visibleIds = useMemo(() => items.map((item) => item.id), [items]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  const someVisibleSelected = !allVisibleSelected && visibleIds.some((id) => selectedIds.includes(id));
  const isEmpty = items.length === 0;
  const isSearching = itemSearch.trim().length > 0;
  const knownItemIds = allItemIds.length > 0 ? allItemIds : items.map((item) => item.id);

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = someVisibleSelected;
    }
  }, [someVisibleSelected]);

  useEffect(() => {
    setItems(initialItems);
    setTotalCount(initialTotalCount);
    setHasMore(initialItems.length < initialTotalCount);
    setAllItemIds((previous) => (previous.length > 0 ? previous : initialItems.map((item) => item.id)));
  }, [initialItems, initialTotalCount]);

  const refreshAllItemIds = useCallback(async () => {
    try {
      const allItems = await fetchAllItems(supabase, { sortBy: 'id', sortDir: 'asc' });
      setAllItemIds(allItems.map((item) => item.id));
    } catch (error) {
      console.error('Failed to refresh item IDs', error);
    }
  }, [supabase]);

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

  const refreshRegistryData = useCallback(
    async (search: string, nextSortOrder: SortOrder) => {
      await Promise.all([refreshList(search, nextSortOrder), refreshAllItemIds()]);
    },
    [refreshAllItemIds, refreshList],
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
      void refreshAllItemIds();
      return;
    }

    const timeout = window.setTimeout(() => {
      void refreshList(itemSearch, sortOrder);
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [itemSearch, refreshAllItemIds, refreshList, regexSearchEnabled, sortOrder]);

  const batchRenamePreview = useMemo(() => {
    if (selectedIds.length === 0) {
      return { error: null as string | null, renames: [], changedCount: 0 };
    }

    if (!regexSearchEnabled) {
      return { error: 'Enable regex search to batch rename the selected items.', renames: [], changedCount: 0 };
    }

    if (!itemSearch.trim()) {
      return { error: 'Enter a find regex in Search to batch rename the selected items.', renames: [], changedCount: 0 };
    }

    try {
      const preview = previewRegexRename(
        selectedIds,
        itemSearch,
        regexReplaceValue,
      );
      const validation = validateItemRenames(knownItemIds, preview.renames);

      if (!validation.ok) {
        return { error: validation.error, renames: [], changedCount: preview.changedCount };
      }

      return { error: null as string | null, renames: validation.renames, changedCount: preview.changedCount };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Invalid regex pattern.',
        renames: [],
        changedCount: 0,
      };
    }
  }, [itemSearch, knownItemIds, regexReplaceValue, regexSearchEnabled, selectedIds]);

  const handleSearchChange = (value: string) => {
    setItemSearch(value);
    setDeleteError(null);
    setDeleteFeedback(null);
    setRenameError(null);
    setRenameFeedback(null);
  };

  const handleRegexToggle = (checked: boolean) => {
    setRegexSearchEnabled(checked);
    setDeleteError(null);
    setDeleteFeedback(null);
    setListError(null);
    setRenameError(null);
    setRenameFeedback(null);
  };

  const toggleSelected = (id: string, checked: boolean) => {
    setSelectedIds((previous) =>
      checked ? Array.from(new Set([...previous, id])) : previous.filter((selectedId) => selectedId !== id),
    );
    setRenameError(null);
    setRenameFeedback(null);
  };

  const toggleSelectAllVisible = (checked: boolean) => {
    setSelectedIds((previous) => {
      if (!checked) {
        return previous.filter((id) => !visibleIds.includes(id));
      }

      return Array.from(new Set([...previous, ...visibleIds]));
    });
    setRenameError(null);
    setRenameFeedback(null);
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
      await refreshRegistryData(itemSearch, sortOrder);
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
      await refreshRegistryData(itemSearch, sortOrder);
      router.refresh();
    });
  };

  const startInlineRename = (item: ItemRow) => {
    setEditingItemId(item.id);
    setSingleRenameValue(item.id);
    setRenameError(null);
    setRenameFeedback(null);
  };

  const cancelInlineRename = () => {
    setEditingItemId(null);
    setSingleRenameValue('');
  };

  const resetRenameView = useCallback(() => {
    setItemSearch('');
    setRegexSearchEnabled(false);
    setSelectedIds([]);
  }, []);

  const handleSingleRename = (item: ItemRow) => {
    const nextId = singleRenameValue.trim();
    const validation = validateItemRenames(knownItemIds, [{ from: item.id, to: nextId }]);

    if (!validation.ok) {
      setRenameError(validation.error);
      setRenameFeedback(null);
      return;
    }

    if (validation.renames.length === 0) {
      cancelInlineRename();
      return;
    }

    setRenameError(null);
    setRenameFeedback(null);
    setDeleteError(null);
    setDeleteFeedback(null);
    setRegisterError(null);
    setRegisterFeedback(null);

    startRenamingItems(async () => {
      const response = await renameItemAction({ from: item.id, to: nextId });
      if (!response.ok) {
        setRenameError(response.error ?? 'Unable to rename item.');
        return;
      }

      setRenameFeedback(
        `Renamed ${item.id} to ${nextId}${response.updatedTableCount > 0 ? ` and updated ${response.updatedTableCount} loot table${response.updatedTableCount === 1 ? '' : 's'}` : ''}.`,
      );
      cancelInlineRename();
      resetRenameView();
      await refreshRegistryData('', sortOrder);
      router.refresh();
    });
  };

  const handleBatchRename = () => {
    if (selectedIds.length === 0) {
      return;
    }

    if (batchRenamePreview.error) {
      setRenameError(batchRenamePreview.error);
      setRenameFeedback(null);
      return;
    }

    if (batchRenamePreview.renames.length === 0) {
      setRenameError('The current regex would not rename any selected items.');
      setRenameFeedback(null);
      return;
    }

    setRenameError(null);
    setRenameFeedback(null);
    setDeleteError(null);
    setDeleteFeedback(null);
    setRegisterError(null);
    setRegisterFeedback(null);

    startRenamingItems(async () => {
      const response = await renameItemsAction(batchRenamePreview.renames);
      if (!response.ok) {
        setRenameError(response.error ?? 'Unable to rename selected items.');
        return;
      }

      setRenameFeedback(
        `Renamed ${response.renamedCount} item${response.renamedCount === 1 ? '' : 's'}${response.updatedTableCount > 0 ? ` and updated ${response.updatedTableCount} loot table${response.updatedTableCount === 1 ? '' : 's'}` : ''}.`,
      );
      resetRenameView();
      await refreshRegistryData('', sortOrder);
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
          <div className="flex flex-wrap items-end gap-4">
            <div className="grid flex-1 gap-2 min-[640px]:min-w-80">
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
            {selectedIds.length > 0 && (
              <div className="grid flex-1 gap-2 min-[640px]:min-w-80">
                <Label htmlFor="item-rename-replace">Replace regex</Label>
                <Input
                  id="item-rename-replace"
                  value={regexReplaceValue}
                  onChange={(event) => {
                    setRegexReplaceValue(event.target.value);
                    setRenameError(null);
                    setRenameFeedback(null);
                  }}
                  placeholder="Replacement for the selected items"
                />
                <p className="text-xs text-foreground/60">
                  Search is used as the find regex for the {selectedIds.length} selected item{selectedIds.length === 1 ? '' : 's'}.
                </p>
              </div>
            )}
            <div className="grid w-full gap-2 min-[640px]:w-40">
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
              <div className="flex w-full flex-wrap items-end gap-3 min-[900px]:ml-auto min-[900px]:w-auto">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBatchRename}
                  disabled={renamingItems || !!batchRenamePreview.error || batchRenamePreview.renames.length === 0}
                >
                  {renamingItems ? `Renaming ${selectedIds.length} items...` : `Rename ${selectedIds.length} items`}
                </Button>
                <Button type="button" variant="destructive" onClick={handleDeleteItems} disabled={deletingItems} className="gap-2">
                  <Trash2 className="h-4 w-4" />
                  {deletingItems ? `Deleting ${selectedIds.length} items...` : `Delete ${selectedIds.length} items`}
                </Button>
              </div>
            )}
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

          {(deleteError || deleteFeedback || listError || renameError || renameFeedback || selectedIds.length > 0) && (
            <div className="space-y-1">
              {listError && <p className="text-sm text-destructive">{listError}</p>}
              {selectedIds.length > 0 && !renameError && !renameFeedback && batchRenamePreview.error && (
                <p className="text-sm text-destructive">{batchRenamePreview.error}</p>
              )}
              {selectedIds.length > 0 && !renameError && !renameFeedback && !batchRenamePreview.error && (
                <p className="text-sm text-foreground/65">
                  {batchRenamePreview.renames.length > 0
                    ? `${batchRenamePreview.renames.length} selected item${batchRenamePreview.renames.length === 1 ? '' : 's'} will be renamed.`
                    : 'The current regex does not change any selected item IDs.'}
                </p>
              )}
              {renameError && <p className="text-sm text-destructive">{renameError}</p>}
              {renameFeedback && <p className="text-sm text-primary">{renameFeedback}</p>}
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
                  <th className="w-28 px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingPage && isEmpty ? (
                  <tr>
                    <td className="px-4 py-6 text-center text-foreground/60" colSpan={4}>
                      Loading items...
                    </td>
                  </tr>
                ) : isEmpty ? (
                  <tr>
                    <td className="px-4 py-6 text-center text-foreground/50" colSpan={4}>
                      {isSearching ? 'No items match that ID search.' : 'No items registered yet.'}
                    </td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const isSelected = selectedIds.includes(item.id);
                    const isEditing = editingItemId === item.id;
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
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <Input
                                value={singleRenameValue}
                                onChange={(event) => setSingleRenameValue(event.target.value)}
                                className="h-8 max-w-sm font-mono text-xs"
                                aria-label={`Rename ${item.id}`}
                              />
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                onClick={() => handleSingleRename(item)}
                                disabled={renamingItems}
                                aria-label={`Save rename for ${item.id}`}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                onClick={cancelInlineRename}
                                disabled={renamingItems}
                                aria-label={`Cancel rename for ${item.id}`}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <span className="font-mono text-xs text-white">{item.id}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-foreground/65">
                          {new Date(item.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {!isEditing && (
                            <Button type="button" variant="ghost" size="icon" onClick={() => startInlineRename(item)} aria-label={`Rename ${item.id}`}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
                {isLoadingMore && !isEmpty && (
                  <tr>
                    <td className="px-4 py-4 text-center text-foreground/60" colSpan={4}>
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
