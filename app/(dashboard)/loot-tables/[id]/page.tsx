import { promises as fs } from "fs";
import { getSampleTables } from "@/lib/data/sample-tables";
import { LootTableEditorView } from "@/components/loot-editor/loot-table-editor-view";

export default async function LootTableEditorPage({ params }: { params: { id: string } }) {
  const tables = await getSampleTables();
  const table = tables.find((t) => t.id === params.id);

  if (!table) {
    const fallback = {
      id: params.id,
      name: `Loot table ${params.id}`,
      type: "minecraft:chest",
      pools: [],
    };
    return <LootTableEditorView id={params.id} data={fallback} sample={false} />;
  }

  const raw = await fs.readFile(table.path, "utf-8");
  const data = JSON.parse(raw);
  return <LootTableEditorView id={params.id} data={data} sample />;
}
