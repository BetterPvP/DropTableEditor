import { Metadata } from 'next';
import { AccountSettings } from '@/components/settings/account-settings';
import { createServerSupabaseClient } from '@/supabase/server';

export const metadata: Metadata = {
  title: 'Settings | BetterPvP Admin Console',
};

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const supabase = createServerSupabaseClient();
  const [{ data: auth }, { data: invites }, { data: items }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('invite_codes').select('*').order('created_at', { ascending: false }),
    supabase.from('items').select('*').order('created_at', { ascending: false }),
  ]);

  return (
    <AccountSettings
      user={auth.user}
      invites={invites ?? []}
      items={items ?? []}
    />
  );
}
