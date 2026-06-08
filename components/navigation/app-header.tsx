'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { signOutAction } from '@/lib/auth/actions';

interface AppHeaderProps {
  environment?: 'development' | 'staging' | 'production';
}

export function AppHeader({ environment = 'development' }: AppHeaderProps) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-background px-6">
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
          <Sparkles className="h-5 w-5 text-primary" />
          BetterPvP Admin Console
        </Link>
        <Badge variant={environment === 'production' ? 'default' : 'info'} className="uppercase tracking-wide">
          {environment}
        </Badge>
        <Separator orientation="vertical" />
        <span className="hidden text-sm text-foreground/60 md:inline" aria-live="polite">
          {pathname === '/' ? 'Overview' : 'Workspace'}
        </span>
      </div>
      <form action={signOutAction}>
        <Button variant="outline" size="sm" className="gap-2" type="submit">
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </form>
    </header>
  );
}
