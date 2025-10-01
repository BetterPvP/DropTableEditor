import { notFound } from 'next/navigation';
import { sampleLootTables } from '@/lib/loot-tables/sample';
import { LootTableEditor } from '@/components/editor/loot-table-editor';

interface LootTableEditorPageProps {
  params: { id: string };
}

export async function generateStaticParams() {
  return sampleLootTables.map((table) => ({ id: table.id }));
}

export default function LootTableEditorPage({ params }: LootTableEditorPageProps) {
  const table = sampleLootTables.find((item) => item.id === params.id);
  if (!table) {
    notFound();
  }

  return <LootTableEditor table={table} />;
}
