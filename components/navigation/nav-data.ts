import { CONTENT_TYPES } from '@/lib/content/registry';
import { TUNING_TABLES } from '@/lib/tuning/registry';

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
    items: [
      ...CONTENT_TYPES.map((c) => ({ href: `/${c.slug}`, label: c.plural, icon: c.icon })),
      { href: '/quest-npcs', label: 'Quest NPCs', icon: 'flag' },
    ],
  },
  {
    title: 'Game Tuning',
    items: TUNING_TABLES.map((t) => ({ href: `/tuning/${t.slug}`, label: t.label, icon: 'settings' })),
  },
  {
    title: 'Reference',
    items: [
      { href: '/reference/items', label: 'Items', icon: 'package' },
      { href: '/insights', label: 'Insights', icon: 'chart' },
    ],
  },
];
