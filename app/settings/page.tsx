import { Metadata } from 'next';
import { AccountSettings } from '@/components/settings/account-settings';

export const metadata: Metadata = {
  title: 'Settings | BetterPvP Admin Console',
};

export default function SettingsPage() {
  return <AccountSettings />;
}
