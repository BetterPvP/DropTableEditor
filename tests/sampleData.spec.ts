import { describe, expect, test } from "vitest";
import { getSampleTables } from "@/lib/data/sample-tables";
import { promises as fs } from "fs";

describe("sample loot tables", () => {
  test("all sample files parse to objects", async () => {
    const tables = await getSampleTables();
    expect(tables.length).toBeGreaterThan(0);

    for (const table of tables) {
      const raw = await fs.readFile(table.path, "utf-8");
      const parsed = JSON.parse(raw);
      expect(parsed && typeof parsed === "object").toBe(true);
    }
  });
});
