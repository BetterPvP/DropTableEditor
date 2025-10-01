'use client';

import { FormEvent, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Database } from '@/supabase/types';
import { createInviteCodeAction, registerItemAction } from '@/app/settings/actions';

interface AccountSettingsProps {
  user: User | null;
  invites: Database['public']['Tables']['invite_codes']['Row'][];
  items: Database['public']['Tables']['items']['Row'][];
}

export function AccountSettings({ user, invites, items }: AccountSettingsProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(user?.user_metadata?.full_name ?? '');
  const [inviteRole, setInviteRole] = useState('admin');
  const [inviteCode, setInviteCode] = useState('');
  const [inviteFeedback, setInviteFeedback] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [creatingInvite, startCreateInvite] = useTransition();
  const [itemId, setItemId] = useState('');
  const [itemError, setItemError] = useState<string | null>(null);
  const [itemFeedback, setItemFeedback] = useState<string | null>(null);
  const [registeringItem, startRegisterItem] = useTransition();
  const [itemSearch, setItemSearch] = useState('');

  const filteredItems = useMemo(() => {
    const query = itemSearch.trim().toLowerCase();
    if (!query) {
      return items;
    }
    return items.filter((item) => {
      const id = item.id.toLowerCase();
      const name = (item.name ?? '').toLowerCase();
      return id.includes(query) || name.includes(query);
    });
  }, [itemSearch, items]);

  const handleInviteSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setInviteError(null);
    setInviteFeedback(null);
    const formData = new FormData();
    formData.append('role', inviteRole);
    if (inviteCode.trim()) {
      formData.append('code', inviteCode.trim());
    }
    startCreateInvite(async () => {
      const response = await createInviteCodeAction(formData);
      if (response && !response.ok) {
        setInviteError(response.error ?? 'Unable to create invite code');
        return;
      }
      if (response?.ok) {
        setInviteFeedback(`Invite code ${response.code} created.`);
        setInviteCode('');
        router.refresh();
      }
    });
  };

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
      setItemId('');
      router.refresh();
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-white">Settings</h1>
        <p className="text-sm text-foreground/70">Manage your account, invite new admins, and register loot items.</p>
      </div>
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Account</CardTitle>
            <CardDescription>Information sourced from Supabase Auth.</CardDescription>
          </div>
          <Badge variant="info">Read only</Badge>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={user?.email ?? 'unknown'} disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="displayName">Display name</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Optional local label"
            />
            <p className="text-xs text-foreground/50">Display name is stored locally only and does not sync to Supabase.</p>
          </div>
          <div className="space-y-2">
            <Label>User ID</Label>
            <Input value={user?.id ?? 'unauthenticated'} disabled />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Invite codes</CardTitle>
            <CardDescription>Generate invite-only access for new administrators.</CardDescription>
          </div>
          <Badge variant="default">{invites.length} codes</Badge>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <form className="space-y-4 rounded-2xl border border-white/10 bg-black/40 p-4" onSubmit={handleInviteSubmit}>
            <div className="space-y-2">
              <Label htmlFor="invite-role">Role</Label>
              <Input
                id="invite-role"
                value={inviteRole}
                onChange={(event) => setInviteRole(event.target.value)}
                placeholder="admin"
              />
              <p className="text-xs text-foreground/50">Roles mirror Supabase policies. Use descriptive labels like admin or designer.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-code">Custom code (optional)</Label>
              <Input
                id="invite-code"
                value={inviteCode}
                onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
                placeholder="ADMIN-XYZ123"
              />
              <p className="text-xs text-foreground/50">Leave blank to generate a secure code automatically.</p>
            </div>
            <Button type="submit" disabled={creatingInvite}>
              {creatingInvite ? 'Creating…' : 'Create invite'}
            </Button>
            {inviteError && <p className="text-sm text-destructive">{inviteError}</p>}
            {inviteFeedback && <p className="text-sm text-primary">{inviteFeedback}</p>}
          </form>
          <ScrollArea className="h-64 rounded-2xl border border-white/10 bg-black/30">
            <table className="w-full text-sm text-foreground/80">
              <thead className="sticky top-0 bg-black/60 text-xs uppercase tracking-wide text-foreground/60">
                <tr>
                  <th className="px-4 py-2 text-left">Code</th>
                  <th className="px-4 py-2 text-left">Role</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Created</th>
                </tr>
              </thead>
              <tbody>
                {invites.length === 0 && (
                  <tr>
                    <td className="px-4 py-4 text-center text-foreground/50" colSpan={4}>
                      No invite codes yet. Generate one for your next teammate.
                    </td>
                  </tr>
                )}
                {invites.map((invite) => (
                  <tr key={invite.code} className="border-b border-white/5">
                    <td className="px-4 py-2 font-mono text-xs">{invite.code}</td>
                    <td className="px-4 py-2 capitalize">{invite.role}</td>
                    <td className="px-4 py-2">
                      {invite.used_at ? (
                        <Badge variant="outline">Used</Badge>
                      ) : (
                        <Badge variant="info">Available</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs text-foreground/60">
                      {new Date(invite.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        </CardContent>
      </Card>

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
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td className="px-4 py-4 text-center text-foreground/50" colSpan={2}>
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
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </ScrollArea>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
