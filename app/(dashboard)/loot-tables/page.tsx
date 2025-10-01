import Link from "next/link";
import { getSampleTables } from "@/lib/data/sample-tables";
import { Button } from "@/components/ui/button";
import { LootTablesList } from "@/components/loot-editor/loot-tables-list";
import { Suspense } from "react";

export default async function LootTablesPage() {
  const tables = await getSampleTables();

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-black/20 p-8 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">Loot tables</h1>
            <p className="text-sm text-muted-foreground">Browse, search, and create new tables.</p>
          </div>
          <Link href="/loot-tables/new">
            <Button size="lg">Create loot table</Button>
          </Link>
        </div>
      </div>
      <Suspense fallback={<p className="text-muted-foreground">Loading tables...</p>}>
        <LootTablesList tables={tables} />
      </Suspense>
    </div>
  );
}
