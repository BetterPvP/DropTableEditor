import { CONTENT_TYPES } from '@/lib/content/registry';

export interface NavItem {
  href: string;
  label: string;
  icon: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Content',
    items: CONTENT_TYPES.map((c) => ({ href: `/${c.slug}`, label: c.plural, icon: c.icon })),
  },
  {
    title: 'Reference',
    items: [
      { href: '/reference/items', label: 'Items', icon: 'package' },
      { href: '/insights', label: 'Insights', icon: 'chart' },
    ],
  },
];
