import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="flex w-full max-w-3xl flex-col items-center gap-8 text-center">
        <h1 className="text-6xl font-semibold tracking-tight text-white sm:text-7xl">BetterPvP</h1>
        <Button asChild size="lg" className="px-10 text-base">
          <Link href="/loot-tables">Enter Dashboard →</Link>
        </Button>
      </div>
    </main>
  );
}
