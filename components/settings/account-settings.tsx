'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SaveIndicator } from '@/components/save-indicator';
import { useAutosave } from '@/lib/hooks/use-autosave';

interface AccountState {
  displayName: string;
  email: string;
}

const initialState: AccountState = {
  displayName: 'Admin',
  email: 'admin@example.com',
};

export function AccountSettings() {
  const [state, setState] = useState<AccountState>(initialState);

  const autosave = useAutosave({
    key: 'account-settings',
    version: 1,
    value: state,
    onSave: async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-white">Settings</h1>
        <p className="text-sm text-foreground/70">Manage your profile and environment preferences.</p>
      </div>
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Account</CardTitle>
            <CardDescription>Information synced from Supabase auth.</CardDescription>
          </div>
          <SaveIndicator status={autosave.status} />
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="displayName">Display name</Label>
            <Input
              id="displayName"
              value={state.displayName}
              onChange={(event) => setState((prev) => ({ ...prev, displayName: event.target.value }))}
              onBlur={autosave.handleBlur}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={state.email} disabled />
          </div>
          <div className="col-span-full flex gap-3">
            <Button type="button" onClick={() => autosave.saveNow()}>Save now</Button>
            <Button type="button" variant="outline" onClick={() => setState(initialState)}>
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
