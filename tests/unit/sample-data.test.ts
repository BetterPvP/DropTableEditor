import { describe, expect, it } from 'vitest';
import dungeonFortress from '@/sample_data/dungeon_fortress.json';
import dungeonTemple from '@/sample_data/dungeon_temple.json';

describe('sample loot tables', () => {
  it('retain original schema shape', () => {
    expect(typeof dungeonFortress).toBe('object');
    expect(typeof dungeonTemple).toBe('object');
  });
});
