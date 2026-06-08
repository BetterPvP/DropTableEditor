import Link from 'next/link';
import { listAllContentLinks, contentCounts } from '@/lib/db/repositories/content';
import { contentTypeByType } from '@/lib/content/registry';
import { Badge } from '@/components/ui/badge';
import type { ContentType } from '@/lib/db/types';

export default async function InsightsPage() {
  const [counts, links] = await Promise.all([contentCounts(), listAllContentLinks()]);

  const linkHref = (type: string | null, id: string) => {
    const def = type ? contentTypeByType(type as ContentType) : undefined;
    return def ? `/${def.slug}/${id}` : '#';
  };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Insights</h1>
        <p className="text-sm text-foreground/60">Content overview and cross-references across the story graph.</p>
      </div>

      {/* Content counts */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/60">Content</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {counts.length === 0 && <p className="text-sm text-foreground/40">No content yet.</p>}
          {counts.map((c) => {
            const def = contentTypeByType(c.type as ContentType);
            return (
              <Link
                key={c.type}
                href={def ? `/${def.slug}` : '#'}
                className="glass-panel rounded-lg border p-4 transition-colors hover:border-primary/50"
              >
                <div className="text-2xl font-semibold">{c.total}</div>
                <div className="text-sm text-foreground/70">{def?.plural ?? c.type}</div>
                <div className="mt-1 text-xs text-foreground/45">{c.published} published · {c.draft} draft</div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Cross-references (content_links cache) */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/60">Cross-references</h2>
        <p className="text-xs text-foreground/45">
          Rebuilt on publish — which published content references which (rewards, conversations, quest dependencies…).
        </p>
        {links.length === 0 ? (
          <div className="glass-panel rounded-lg border p-6 text-center text-sm text-foreground/40">
            No references yet. Publish content that references other content to populate this.
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {links.map((l, i) => (
              <li key={i} className="glass-panel flex items-center gap-2 rounded-lg border px-4 py-2 text-sm">
                <Link href={linkHref(l.fromType, l.fromId)} className="font-medium hover:text-primary">{l.fromName}</Link>
                <Badge variant="outline">{l.kind}</Badge>
                <span className="text-foreground/40">→</span>
                {l.toName ? (
                  <Link href={linkHref(l.toType, l.toId)} className="hover:text-primary">{l.toName}</Link>
                ) : (
                  <span className="text-amber-400/80">missing ({l.toId.slice(0, 8)}…)</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Loki funnels — wired once the game emits telemetry */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/60">Quest funnels (Loki)</h2>
        <div className="glass-panel rounded-lg border p-6 text-sm text-foreground/50">
          <p className="mb-2">
            When the game emits <code className="text-foreground/70">quest_event{'{saga,quest,stage,scope,action}'}</code> to
            Loki, this panel queries the Loki HTTP API and renders per-quest funnels (started → stage → completed →
            abandoned), time-to-complete, and choice histograms with Recharts.
          </p>
          <p className="text-foreground/40">Pending game-side telemetry.</p>
        </div>
      </section>
    </div>
  );
}
