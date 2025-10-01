import Link from 'next/link';
import { ArrowRight, Rocket, Workflow } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const tools = [
  {
    name: 'Loot Table Builder',
    description: 'Craft, validate, and simulate loot tables with confidence.',
    href: '/loot-tables',
    icon: Workflow,
  },
];

export default function HomePage() {
  return (
    <div className="space-y-12">
      <section className="glass-panel relative overflow-hidden rounded-3xl border border-white/10 p-12">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/30 via-transparent to-purple-600/20 opacity-80" />
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-4">
            <p className="text-sm uppercase tracking-widest text-primary/80">BetterPvP Clans</p>
            <h1 className="text-4xl font-bold leading-tight text-white sm:text-5xl">
              BetterPvP Admin Console
            </h1>
            <p className="max-w-2xl text-lg text-foreground/80">
              Manage loot distribution, validate balance with deterministic simulations, and collaborate with your team using a
              next-gen glassmorphism interface.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/loot-tables">
                  Launch Builder
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" className="gap-2" asChild>
                <Link href="/settings">View Settings</Link>
              </Button>
            </div>
          </div>
          <div className="grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-foreground/80">
            <div className="flex items-center gap-3">
              <Rocket className="h-5 w-5 text-primary" />
              <div>
                <p className="font-semibold text-white">Hybrid autosave</p>
                <p>Debounced, on-blur, and crash-safe local drafts.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ArrowRight className="h-5 w-5 text-accent" />
              <div>
                <p className="font-semibold text-white">Monte Carlo simulation</p>
                <p>Deterministic seeds, worker threads, actionable stats.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-white">Tools</h2>
            <p className="text-sm text-foreground/70">Jump into specialized consoles purpose-built for Clans.</p>
          </div>
          <Button variant="ghost" asChild className="gap-2">
            <Link href="/loot-tables">
              Explore all
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {tools.map((tool) => (
            <Card key={tool.name} className="flex h-full flex-col justify-between transition hover:border-primary/60 hover:shadow-[0_0_40px_rgba(95,176,255,0.25)]">
              <CardHeader>
                <tool.icon className="mb-4 h-10 w-10 text-primary" />
                <CardTitle>{tool.name}</CardTitle>
                <CardDescription>{tool.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full justify-between">
                  <Link href={tool.href}>
                    Open
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
