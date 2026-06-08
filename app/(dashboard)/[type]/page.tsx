import { notFound } from 'next/navigation';
import Link from 'next/link';
import { contentTypeBySlug } from '@/lib/content/registry';
import { createContentAction } from '@/lib/content/actions';
import { listContent } from '@/lib/db/repositories/content';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const STATUS_VARIANT = {
  draft: 'outline',
  published: 'info',
  archived: 'default',
} as const;

export default async function ContentIndexPage({ params }: { params: { type: string } }) {
  const def = contentTypeBySlug(params.type);
  if (!def) notFound();

  const rows = await listContent(def.type);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{def.plural}</h1>
          <p className="text-sm text-foreground/60">{def.description}</p>
        </div>
        <form action={createContentAction.bind(null, def.slug)} className="flex items-center gap-2">
          <Input name="name" placeholder={`New ${def.label} name`} className="w-56" />
          <Button type="submit">New {def.label}</Button>
        </form>
      </div>

      {rows.length === 0 ? (
        <div className="glass-panel rounded-lg border p-10 text-center text-foreground/50">
          No {def.plural.toLowerCase()} yet. Create one to get started.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                href={`/${def.slug}/${row.id}`}
                className="glass-panel flex items-center justify-between rounded-lg border px-4 py-3 transition-colors hover:border-primary/50"
              >
                <div className="flex flex-col">
                  <span className="font-medium">{row.name}</span>
                  {row.description && <span className="text-xs text-foreground/50">{row.description}</span>}
                </div>
                <div className="flex items-center gap-3 text-xs text-foreground/50">
                  <span>v{row.version}</span>
                  <Badge variant={STATUS_VARIANT[row.status]}>{row.status}</Badge>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
