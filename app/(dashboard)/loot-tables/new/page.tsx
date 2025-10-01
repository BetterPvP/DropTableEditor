import { LootTableEditorView } from "@/components/loot-editor/loot-table-editor-view";

export default function NewLootTablePage() {
  const data = {
    id: "new",
    name: "New loot table",
    type: "minecraft:chest",
    pools: [],
    version: 1,
  };

  return <LootTableEditorView id="new" data={data} sample={false} />;
}
