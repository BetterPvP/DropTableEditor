import { notFound } from 'next/navigation';
import { contentTypeBySlug } from '@/lib/content/registry';
import { getContent } from '@/lib/db/repositories/content';
import { listItems } from '@/lib/db/repositories/manifest';
import { loadEditorManifest } from '@/lib/content/manifest';
import { LootTableEditor, type EditorItem } from '@/components/editor/loot-table-form';
import { ConversationEditor } from '@/components/content/conversation-editor';
import { SagaEditor } from '@/components/content/saga-editor';
import { QuestEditor } from '@/components/content/quest-editor';
import { CinematicEditor } from '@/components/content/cinematic-editor';
import type { LootTableDefinition } from '@/lib/content/loot_table/schema';
import type { GraphDraft } from '@/lib/graph/types';
import type { CinematicDefinition } from '@/lib/content/cinematic/schema';

export default async function ContentEditorPage({
  params,
}: {
  params: { type: string; id: string };
}) {
  const def = contentTypeBySlug(params.type);
  if (!def) notFound();

  const record = await getContent(params.id);
  if (!record || record.type !== def.type) notFound();

  if (def.type === 'loot_table') {
    const items: EditorItem[] = (await listItems(undefined, 1000)).map((i) => ({ id: i.key, name: i.display_name }));
    return (
      <LootTableEditor
        tableId={record.id}
        initialRevision={record.revision}
        definition={record.draft as LootTableDefinition}
        items={items}
      />
    );
  }

  // Graph + timeline editors all need the reference manifest.
  const manifest = await loadEditorManifest();
  const common = { id: record.id, initialRevision: record.revision, manifest };

  switch (def.type) {
    case 'conversation':
      return <ConversationEditor {...common} initialDraft={record.draft as GraphDraft} />;
    case 'saga':
      return <SagaEditor {...common} initialDraft={record.draft as GraphDraft} />;
    case 'quest':
      return <QuestEditor {...common} initialDraft={record.draft as GraphDraft} />;
    case 'cinematic':
      return <CinematicEditor {...common} initialDraft={record.draft as CinematicDefinition} />;
    default:
      notFound();
  }
}
