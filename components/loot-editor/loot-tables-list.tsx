"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SampleLootTable } from "@/lib/data/sample-tables";
import { cn, formatDateTime } from "@/lib/utils";

export function LootTablesList({ tables }: { tables: SampleLootTable[] }) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  const filtered = useMemo(() => {
    if (!deferredQuery) return tables;
    return tables.filter((table) => table.name.toLowerCase().includes(deferredQuery) || table.id.includes(deferredQuery));
  }, [deferredQuery, tables]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search loot tables..."
          className="md:max-w-sm"
          aria-label="Search loot tables"
        />
        <Badge variant="outline">{filtered.length} tables</Badge>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        {filtered.map((table) => (
          <Card key={table.id} className="group border-white/10 transition-colors hover:border-primary/40">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">{table.name}</CardTitle>
                <Badge variant="outline">Sample</Badge>
              </div>
              <CardDescription className="flex items-center justify-between text-xs">
                <span className="font-mono">{table.id}</span>
                <span>{formatDateTime(Date.now())}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Open the editor to inspect pools, entries, and simulation options.</p>
              </div>
              <Link href={`/loot-tables/${table.id}`} className={cn("rounded-lg border border-transparent px-4 py-2 text-sm font-medium transition-colors group-hover:border-primary/40")}>Open</Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
