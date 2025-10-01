import dungeonFortress from '@/sample_data/dungeon_fortress.json';
import dungeonTemple from '@/sample_data/dungeon_temple.json';

export interface LootTableMeta {
  id: string;
  name: string;
  description?: string;
  updated_at: string;
  version: number;
  tags?: string[];
  data: unknown;
}

export const sampleLootTables: LootTableMeta[] = [
  {
    id: 'dungeon_fortress',
    name: 'Dungeon Fortress',
    description: 'High tier fortress loot with blaze rods and nether wart.',
    updated_at: new Date('2024-10-05T12:00:00Z').toISOString(),
    version: 3,
    tags: ['nether', 'raid'],
    data: dungeonFortress,
  },
  {
    id: 'dungeon_temple',
    name: 'Dungeon Temple',
    description: 'Temple loot balancing for mid-game progression.',
    updated_at: new Date('2024-09-18T09:15:00Z').toISOString(),
    version: 2,
    tags: ['temple', 'pve'],
    data: dungeonTemple,
  },
];
