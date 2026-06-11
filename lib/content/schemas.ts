import { z } from 'zod';
import type { ContentType } from '@/lib/db/types';
import { lootTableDefinitionSchema, makeDefaultLootTable, type LootEntry } from './loot_table/schema';
import { conversationSchema, makeDefaultConversation, type ResponseDefinition, type ResponseOutcome } from './conversation/schema';
import { sagaSchema, makeDefaultSaga } from './saga/schema';
import { questSchema, makeDefaultQuest } from './quest/schema';
import { cinematicSchema, makeDefaultCinematic } from './cinematic/schema';
import { primitiveById } from '@/lib/primitives/registry';
import type { PrimitiveInstance } from '@/lib/primitives/types';
import type { GraphNode } from '@/lib/graph/types';

/**
 * Per-content-type schema + default factory + reference extraction. Validates
 * drafts on save and (with reference integrity) on publish; reference extractors
 * feed the content_links cache and item reference-checks.
 */
export interface ContentSchemaDef {
  schema: z.ZodTypeAny;
  makeDefault: (id: string, name: string) => unknown;
  referencedItemKeys?: (draft: unknown) => string[];
  referencedContentIds?: (draft: unknown) => Array<{ toId: string; kind: string }>;
}

function lootItemKeys(draft: unknown): string[] {
  const def = draft as { entries?: LootEntry[]; guaranteed?: LootEntry[] };
  const keys: string[] = [];
  for (const entry of [...(def.entries ?? []), ...(def.guaranteed ?? [])]) {
    if ('itemId' in entry && entry.itemId) keys.push(entry.itemId);
  }
  return Array.from(new Set(keys));
}

/** Pull content_ref params out of a list of primitive instances. */
function contentRefsFromPrimitives(list: PrimitiveInstance[] | undefined): Array<{ toId: string; kind: string }> {
  const out: Array<{ toId: string; kind: string }> = [];
  for (const inst of list ?? []) {
    const descriptor = primitiveById(inst.type);
    if (!descriptor) continue;
    for (const [key, spec] of Object.entries(descriptor.params)) {
      if (spec.type === 'content_ref') {
        const value = inst.params?.[key];
        if (typeof value === 'string' && value) out.push({ toId: value, kind: spec.contentType ?? 'content' });
      }
    }
  }
  return out;
}

function dedupeRefs(refs: Array<{ toId: string; kind: string }>): Array<{ toId: string; kind: string }> {
  const seen = new Set<string>();
  return refs.filter((r) => {
    const k = `${r.kind}:${r.toId}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * Map a response outcome to the content links it implies, so publishing records
 * the dependency in the content_links cache (and reference-integrity checks see
 * it). `goto`/`end` stay inside the conversation and contribute no link; empty
 * ids (a half-configured outcome) are skipped so we don't record dangling links.
 */
function outcomeContentRefs(outcome: ResponseOutcome | undefined): Array<{ toId: string; kind: string }> {
  if (!outcome) return [];
  switch (outcome.kind) {
    case 'start_conversation':
      return outcome.conversationId ? [{ toId: outcome.conversationId, kind: 'conversation' }] : [];
    case 'start_cinematic':
      return outcome.cinematicId ? [{ toId: outcome.cinematicId, kind: 'cinematic' }] : [];
    default:
      return [];
  }
}

export const CONTENT_SCHEMAS: Record<ContentType, ContentSchemaDef> = {
  loot_table: {
    schema: lootTableDefinitionSchema,
    makeDefault: (id, name) => makeDefaultLootTable(id, name),
    referencedItemKeys: lootItemKeys,
  },
  saga: {
    schema: sagaSchema,
    makeDefault: (id, name) => makeDefaultSaga(id, name),
    referencedContentIds: (draft) => {
      const d = draft as { nodes?: GraphNode[] };
      return dedupeRefs(
        (d.nodes ?? [])
          .map((n) => n.data?.questId)
          .filter((v): v is string => typeof v === 'string' && Boolean(v))
          .map((toId) => ({ toId, kind: 'quest' })),
      );
    },
  },
  quest: {
    schema: questSchema,
    makeDefault: (id, name) => makeDefaultQuest(id, name),
    referencedContentIds: (draft) => {
      const d = draft as {
        requirements?: PrimitiveInstance[];
        rewards?: PrimitiveInstance[];
        nodes?: GraphNode[];
      };
      const stagePrimitives = (d.nodes ?? []).flatMap((n) => [
        ...((n.data?.objectives as PrimitiveInstance[]) ?? []),
        ...((n.data?.actions as PrimitiveInstance[]) ?? []),
      ]);
      return dedupeRefs([
        ...contentRefsFromPrimitives(d.requirements),
        ...contentRefsFromPrimitives(d.rewards),
        ...contentRefsFromPrimitives(stagePrimitives),
      ]);
    },
  },
  conversation: {
    schema: conversationSchema,
    makeDefault: (id, name) => makeDefaultConversation(id, name),
    referencedContentIds: (draft) => {
      const d = draft as { nodes?: GraphNode[] };
      const responses = (d.nodes ?? []).flatMap(
        (n) => (n.data?.responses as ResponseDefinition[] | undefined) ?? [],
      );
      const actionRefs = contentRefsFromPrimitives(responses.flatMap((r) => r.actions ?? []));
      const outcomeRefs = responses.flatMap((r) => outcomeContentRefs(r.outcome));
      return dedupeRefs([...actionRefs, ...outcomeRefs]);
    },
  },
  cinematic: {
    schema: cinematicSchema,
    makeDefault: (id, name) => makeDefaultCinematic(id, name),
  },
};
