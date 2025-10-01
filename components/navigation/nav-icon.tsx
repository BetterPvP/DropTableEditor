import { cn } from '@/lib/utils';
import { Home, Grid2x2, Settings, Package as PackageIcon, type LucideIcon } from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  home: Home,
  grid: Grid2x2,
  settings: Settings,
  package: PackageIcon,
};

export function NavIcon({ name, className }: { name: string; className?: string }) {
  const IconComponent = ICON_MAP[name] ?? Grid2x2;
  return <IconComponent className={cn('h-4 w-4', className)} strokeWidth={1.5} />;
}
