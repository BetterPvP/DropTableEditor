'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { CircleEllipsis, LogOut, MoonStar, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useTransparency } from '@/components/transparency-provider';
import { createBrowserSupabaseClient } from '@/supabase/client';

interface AppHeaderProps {
  environment?: 'development' | 'staging' | 'production';
}

export function AppHeader({ environment = 'development' }: AppHeaderProps) {
  const pathname = usePathname();
  const { reduced, toggle } = useTransparency();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.replace('/auth/sign-in');
    router.refresh();
    setSigningOut(false);
  };

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-white/10 bg-slate-900/60 px-6 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
          <Sparkles className="h-5 w-5 text-primary" />
          BetterPvP Admin Console
        </Link>
        <Badge variant={environment === 'production' ? 'default' : 'info'} className="uppercase tracking-wide">
          {environment}
        </Badge>
        <Separator orientation="vertical" />
        <div className="hidden items-center gap-2 text-sm text-foreground/60 md:flex" aria-live="polite">
          <CircleEllipsis className="h-4 w-4" />
          <span>{pathname === '/' ? 'Overview' : 'Workspace tools'}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant={reduced ? 'outline' : 'ghost'} size="sm" onClick={toggle} className="gap-2">
          <MoonStar className="h-4 w-4" />
          {reduced ? 'Enable glass' : 'Reduce glass'}
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/account-settings">Account</Link>
        </Button>
        <Button variant="outline" size="sm" className="gap-2" onClick={handleSignOut} disabled={signingOut}>
          <LogOut className="h-4 w-4" />
          {signingOut ? 'Signing out…' : 'Sign out'}
        </Button>
      </div>
    </header>
  );
}
