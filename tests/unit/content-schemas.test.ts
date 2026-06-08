import { describe, expect, it } from 'vitest';
import { CONTENT_SCHEMAS } from '@/lib/content/schemas';
import type { ContentType } from '@/lib/db/types';

const TYPES: ContentType[] = ['loot_table', 'saga', 'quest', 'conversation', 'cinematic'];

describe('content schema registry', () => {
  it('every type validates its own default factory output', () => {
    for (const type of TYPES) {
      const def = CONTENT_SCHEMAS[type];
      const draft = def.makeDefault('id-1', 'Sample');
      const parsed = def.schema.safeParse(draft);
      expect(parsed.success, `${type} default should be valid`).toBe(true);
    }
  });

  it('extracts loot item references', () => {
    const keys = CONTENT_SCHEMAS.loot_table.referencedItemKeys!({
      entries: [{ type: 'dropped_item', itemId: 'minecraft:diamond' }],
      guaranteed: [{ type: 'given_item', itemId: 'betterpvp:coin_bar' }],
    });
    expect(keys.sort()).toEqual(['betterpvp:coin_bar', 'minecraft:diamond']);
  });

  it('extracts saga quest dependencies as content links', () => {
    const refs = CONTENT_SCHEMAS.saga.referencedContentIds!({
      nodes: [
        { id: 'n1', kind: 'quest', position: { x: 0, y: 0 }, data: { questId: 'quest-a' } },
        { id: 'n2', kind: 'quest', position: { x: 0, y: 0 }, data: { questId: 'quest-b' } },
      ],
    });
    expect(refs).toEqual([
      { toId: 'quest-a', kind: 'quest' },
      { toId: 'quest-b', kind: 'quest' },
    ]);
  });

  it('extracts conversation action content refs (e.g. start_conversation)', () => {
    const refs = CONTENT_SCHEMAS.conversation.referencedContentIds!({
      edges: [
        {
          id: 'e1', source: 'a', target: 'b',
          data: { actions: [{ id: 'x', type: 'action.start_conversation', params: { conversation: 'conv-2' } }] },
        },
      ],
    });
    expect(refs).toEqual([{ toId: 'conv-2', kind: 'conversation' }]);
  });
});
