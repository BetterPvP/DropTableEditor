"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { Command } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Toggle } from "@/components/ui/toggle";
import { useTransparency } from "@/components/providers/transparency-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const navItems = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/loot-tables", label: "Loot Tables", icon: "grid" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

type IconName = "home" | "grid" | "settings" | "sparkles";

function Icon({ name, className }: { name: IconName; className?: string }) {
  switch (name) {
    case "home":
      return <Command className={className} />;
    case "grid":
      return <svg className={cn("h-4 w-4", className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
      </svg>;
    case "settings":
      return <svg className={cn("h-4 w-4", className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>;
    default:
      return <Command className={className} />;
  }
}

export function AppShell({ children, environment = "Development" }: { children: ReactNode; environment?: string }) {
  const pathname = usePathname();
  const { reduced, toggle } = useTransparency();
  const activeLabel = navItems.find((item) => pathname?.startsWith(item.href))?.label ?? "";

  return (
    <div className="flex min-h-screen bg-background/95 text-foreground">
      <aside className="hidden border-r border-white/5 bg-black/20 backdrop-blur-xl md:flex md:w-64 md:flex-col">
        <div className="flex items-center gap-3 px-6 py-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-primary">
            <Command className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">BetterPvP</p>
            <p className="text-lg font-semibold">Admin Console</p>
          </div>
        </div>
        <Separator className="mx-6 mb-4" />
        <nav className="flex flex-1 flex-col gap-1 px-4">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
            return (
              <TooltipProvider key={item.href}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:bg-primary/10",
                        active ? "bg-primary/15 text-primary-foreground" : "text-muted-foreground",
                      )}
                    >
                      <Icon name={item.icon as IconName} className="h-4 w-4" />
                      {item.label}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </nav>
        <div className="border-t border-white/5 p-4 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>Transparency</span>
            <Toggle pressed={reduced} onClick={toggle} aria-pressed={reduced} aria-label="Toggle reduced transparency">
              {reduced ? "Reduced" : "Glass"}
            </Toggle>
          </div>
        </div>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-white/5 bg-black/30 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between px-4">
            <div>
              <p className="text-sm text-muted-foreground">{environment}</p>
              <p className="text-lg font-semibold">{activeLabel || "Dashboard"}</p>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/loot-tables/new">
                <Button size="sm" variant="glass">
                  New Loot Table
                </Button>
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-black/30">
                    <Avatar className="h-full w-full">
                      <AvatarFallback>BV</AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href="/settings">Settings</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem>Sign out</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>
        <main className="flex-1 bg-gradient-to-br from-background via-background/95 to-background/80">
          <div className="mx-auto w-full max-w-6xl px-4 py-10">{children}</div>
        </main>
      </div>
    </div>
  );
}
