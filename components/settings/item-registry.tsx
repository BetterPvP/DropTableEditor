'use client';

import { FormEvent, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Database } from '@/supabase/types';
import { registerItemAction, deleteItemAction } from '@/app/item-registry/actions';

interface ItemRegistryProps {
  items: Database['public']['Tables']['items']['Row'][];
}

export function ItemRegistry({ items }: ItemRegistryProps) {
  const router = useRouter();
  const [itemId, setItemId] = useState('');
  const [itemError, setItemError] = useState<string | null>(null);
  const [itemFeedback, setItemFeedback] = useState<string | null>(null);
  const [registeringItem, startRegisterItem] = useTransition();
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [deletingItem, startDeleteItem] = useTransition();

  const handleRegisterItem = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setItemError(null);
    setItemFeedback(null);
    const trimmedId = itemId.trim();
    const formData = new FormData();
    formData.append('id', trimmedId);

    startRegisterItem(async () => {
      const response = await registerItemAction(formData);
      if (response && !response.ok) {
        setItemError(response.error ?? 'Unable to register item');
        return;
      }
      setItemFeedback(`Item ${trimmedId} registered.`);
      setItemId('');
      router.refresh();
    });
  };

  const handleDeleteItem = (id: string) => {
    setItemError(null);
    setItemFeedback(null);
    const formData = new FormData();
    formData.append('id', id);
    setDeletingItemId(id);

    startDeleteItem(async () => {
      const response = await deleteItemAction(formData);
      if (response && !response.ok) {
        setItemError(response.error ?? 'Unable to remove item');
        setDeletingItemId(null);
        return;
      }
      setItemFeedback(`Item ${id} removed.`);
      setDeletingItemId(null);
      router.refresh();
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-white">Item Registry</h1>
        <p className="text-sm text-foreground/70">
          Register items that can be referenced by loot tables and remove entries that are no longer needed.
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
          <ScrollArea className="h-64 rounded-2xl border border-white/10 bg-black/30">
            <table className="w-full text-sm text-foreground/80">
              <thead className="sticky top-0 bg-black/60 text-xs uppercase tracking-wide text-foreground/60">
                <tr>
                  <th className="px-4 py-2 text-left">ID</th>
                  <th className="px-4 py-2 text-left">Registered</th>
                  <th className="px-4 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <tr>
                    <td className="px-4 py-4 text-center text-foreground/50" colSpan={3}>
                      No items registered yet. Add at least one to start building loot tables.
                    </td>
                  </tr>
                )}
                {items.map((item) => {
                  const isDeleting = deletingItem && deletingItemId === item.id;
                  return (
                    <tr key={item.id} className="border-b border-white/5">
                      <td className="px-4 py-2 font-mono text-xs">{item.id}</td>
                      <td className="px-4 py-2 text-xs text-foreground/60">
                        Added {new Date(item.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-2">
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={isDeleting}
                          onClick={() => handleDeleteItem(item.id)}
                        >
                          {isDeleting ? 'Removing…' : 'Remove'}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
