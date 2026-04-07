export interface NavItem {
  href: string;
  label: string;
  icon: string;
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/loot-tables', label: 'Loot Tables', icon: 'grid' },
  { href: '/item-registry', label: 'Item Registry', icon: 'package' },
  { href: '/settings/account', label: 'Account Settings', icon: 'settings' },
];
