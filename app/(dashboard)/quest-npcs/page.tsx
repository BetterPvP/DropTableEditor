import { listQuestNpcs, listFactories } from '@/lib/db/repositories/quest-npcs';
import { QuestNpcsEditor } from '@/components/quest-npcs/editor';

export default async function QuestNpcsPage() {
  const [npcs, factories] = await Promise.all([listQuestNpcs(), listFactories()]);
  return <QuestNpcsEditor npcs={npcs} factories={factories} />;
}
