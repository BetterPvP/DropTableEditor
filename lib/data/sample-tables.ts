import { promises as fs } from "fs";
import path from "path";

export type SampleLootTable = {
  id: string;
  name: string;
  path: string;
};

const sampleFiles = [
  { id: "dungeon_fortress", file: "dungeon_fortress.json", name: "Nether Fortress" },
  { id: "dungeon_temple", file: "dungeon_temple.json", name: "Jungle Temple" },
];

export async function getSampleTables(): Promise<SampleLootTable[]> {
  const base = path.join(process.cwd(), "sample_data");
  return Promise.all(
    sampleFiles.map(async (entry) => {
      const filePath = path.join(base, entry.file);
      await fs.access(filePath);
      return {
        id: entry.id,
        name: entry.name,
        path: filePath,
      } satisfies SampleLootTable;
    }),
  );
}
