import { listItems } from '@/lib/db/repositories/manifest';
import { Badge } from '@/components/ui/badge';

// Read-only browser over the game manifest (game_items). Replaces the old
// hand-curated item registry: identity is owned by the game, the console only
// references it. Populated by `db:seed-manifest` in dev; by the game at runtime.
export default async function ItemsReferencePage() {
  const items = await listItems();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Items</h1>
        <p className="text-sm text-foreground/60">
          Live game item manifest (read-only). {items.length} registered.
        </p>
      </div>
      <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {items.map((item) => (
          <li key={item.key} className="glass-panel flex items-center justify-between rounded-lg border px-3 py-2">
            <div className="flex flex-col">
              <span className="text-sm font-medium">{item.display_name}</span>
              <span className="font-mono text-xs text-foreground/45">{item.key}</span>
            </div>
            <Badge variant={item.source === 'custom' ? 'info' : 'outline'}>{item.source}</Badge>
          </li>
        ))}
      </ul>
      {items.length === 0 && (
        <div className="glass-panel rounded-lg border p-10 text-center text-foreground/50">
          No items in the manifest. Run <code>npm run db:seed-manifest</code> for local data.
        </div>
      )}
    </div>
  );
}
