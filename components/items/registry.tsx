'use client';

import { FormEvent, useMemo, useState, useTransition } from 'react';
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

interface ItemRegistryProps {
  items: Database['public']['Tables']['items']['Row'][];
}

export function ItemRegistry({ items }: ItemRegistryProps) {
  const router = useRouter();
  const [itemId, setItemId] = useState('');
  const [itemError, setItemError] = useState<string | null>(null);
  const [itemFeedback, setItemFeedback] = useState<string | null>(null);
  const [registeringItem, startRegisterItem] = useTransition();

  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteFeedback, setDeleteFeedback] = useState<string | null>(null);
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);
  const [removingItem, startRemoveItem] = useTransition();

  // new search state
  const [itemSearch, setItemSearch] = useState('');
  const filteredItems = useMemo(() => {
    const query = itemSearch.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) => {
      const id = item.id.toLowerCase();
      const name = (item.name ?? '').toLowerCase();
      return id.includes(query) || name.includes(query);
    });
  }, [itemSearch, items]);

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
          <Badge variant="default">{items.length} items</Badge>
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
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td className="px-4 py-4 text-center text-foreground/50" colSpan={3}>
                        {items.length === 0
                          ? 'No items registered yet. Add at least one to start building loot tables.'
                          : 'No items match your search.'}
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => (
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
                </tbody>
              </table>
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
