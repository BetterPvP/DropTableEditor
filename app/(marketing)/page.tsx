import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AppShell } from "@/components/layout/app-shell";

const tools = [
  {
    name: "Loot Table Builder",
    description: "Craft, validate, and simulate complex loot tables with versioned history and Supabase sync.",
    href: "/loot-tables",
  },
  {
    name: "Simulation Suite",
    description: "Analyze Monte Carlo runs, expected values, and percentile outcomes without leaving the editor.",
    href: "/loot-tables",
  },
  {
    name: "Schema Parity",
    description: "Ensure exports remain byte-identical to legacy JSON with automated parity checks.",
    href: "/loot-tables",
  },
];

export default function LandingPage() {
  return (
    <AppShell>
      <section className="space-y-12">
        <header className="glass-panel relative overflow-hidden rounded-3xl border border-white/10 p-10 shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/40 via-transparent to-secondary/40" aria-hidden />
          <div className="relative z-10 grid gap-8 md:grid-cols-2">
            <div className="space-y-6">
              <p className="text-sm uppercase tracking-[0.3em] text-primary-foreground/80">BetterPvP</p>
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
                BetterPvP Admin Console
              </h1>
              <p className="max-w-xl text-lg text-muted-foreground">
                Manage every aspect of Clans loot drops with confidence. Build tables, simulate outcomes, and collaborate in a secure Supabase-powered workspace.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/loot-tables">
                  <Button size="lg">Open Loot Table Builder</Button>
                </Link>
                <Link href="/auth/sign-in">
                  <Button size="lg" variant="glass">
                    Sign in
                  </Button>
                </Link>
              </div>
            </div>
            <div className="flex items-center justify-center">
              <div className="glass-panel flex aspect-square max-w-sm items-center justify-center rounded-3xl border border-white/10">
                <div className="space-y-3 text-center">
                  <p className="text-sm uppercase tracking-widest text-muted-foreground">Live metrics</p>
                  <p className="text-5xl font-bold text-primary">99.9%</p>
                  <p className="text-sm text-muted-foreground">Export parity across migrations</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <section>
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Tools</h2>
            <p className="text-sm text-muted-foreground">More coming soon.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {tools.map((tool) => (
              <Card key={tool.name} className="hover:border-primary/40 hover:shadow-lg hover:shadow-primary/20">
                <CardHeader>
                  <CardTitle>{tool.name}</CardTitle>
                  <CardDescription>{tool.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="glass">
                    <Link href={tool.href}>Launch</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </section>
    </AppShell>
  );
}
