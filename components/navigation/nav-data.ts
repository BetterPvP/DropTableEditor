export interface NavItem {
  href: string;
  label: string;
  icon: string;
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Home', icon: 'home' },
  { href: '/loot-tables', label: 'Loot Tables', icon: 'grid' },
  { href: '/settings', label: 'Settings', icon: 'settings' },
];
