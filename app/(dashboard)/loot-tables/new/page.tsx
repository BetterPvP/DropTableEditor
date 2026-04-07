import { Metadata } from 'next';
import { CreateLootTableForm } from '@/components/loot-tables/create-loot-table-form';

export const metadata: Metadata = {
  title: 'New Loot Table | BetterPvP Admin Console',
};

export default function CreateLootTablePage() {
  return <CreateLootTableForm />;
}
