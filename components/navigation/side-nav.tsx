'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ITEMS } from './nav-data';
import { NavIcon } from './nav-icon';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useState } from 'react';

export function SideNav() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        'glass-panel sticky top-16 flex h-[calc(100vh-4rem)] w-64 flex-col border-r border-white/10 transition-all duration-300',
        collapsed && 'w-20',
      )}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <span className={cn('text-sm font-semibold uppercase tracking-wide text-foreground/60', collapsed && 'sr-only')}>
          Navigation
        </span>
        <Button
          variant="ghost"
          size="icon"
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          onClick={() => setCollapsed((prev) => !prev)}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
      </div>
      <nav className="flex-1 space-y-1 px-2 py-4">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors hover:bg-white/10',
                isActive ? 'bg-primary/20 text-primary' : 'text-foreground/70',
                collapsed && 'justify-center gap-0 px-0',
              )}
            >
              <NavIcon name={item.icon} className={cn(collapsed ? 'h-5 w-5' : 'h-4 w-4')} />
              <span className={cn('truncate', collapsed && 'sr-only')}>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
