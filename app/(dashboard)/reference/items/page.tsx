import { listItems } from '@/lib/db/repositories/manifest';
import { ItemsBrowser } from '@/components/reference/items-browser';

// Read-only browser over the game manifest (game_items). Replaces the old
// hand-curated item registry: identity is owned by the game, the console only
// references it. Populated by `db:seed-manifest` in dev; by the game at runtime.
export default async function ItemsReferencePage() {
  const items = await listItems();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Items</h1>
        <p className="text-sm text-foreground/60">Live game item manifest (read-only).</p>
      </div>
      {items.length === 0 ? (
        <div className="glass-panel rounded-lg border p-10 text-center text-foreground/50">
          No items in the manifest. Run <code>npm run db:seed-manifest</code> for local data.
        </div>
      ) : (
        <ItemsBrowser items={items} />
      )}
    </div>
  );
}
