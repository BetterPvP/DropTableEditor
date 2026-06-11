import { z } from 'zod';
import { graphNodeSchema, graphEdgeSchema, primitiveInstanceSchema } from '../graph-schema';

/**
 * A response is an actionable choice under a dialogue line. Its identity is its
 * `outcome` — a discriminated union describing what happens to the conversation
 * when the player picks it — not a graph edge. `conditions` gate visibility and
 * `actions` are orthogonal side effects that fire regardless of the outcome.
 */
export const responseOutcomeSchema = z.discriminatedUnion('kind', [
  /** Branch: continue the conversation at another dialogue node. */
  z.object({ kind: z.literal('goto'), target: z.string() }),
  /** Terminate the conversation cleanly. */
  z.object({ kind: z.literal('end') }),
  /** Hand off to another conversation by id. */
  z.object({ kind: z.literal('start_conversation'), conversationId: z.string() }),
  /** Hand off to a cinematic by id. */
  z.object({ kind: z.literal('start_cinematic'), cinematicId: z.string() }),
]);

export type ResponseOutcome = z.infer<typeof responseOutcomeSchema>;
export type ResponseOutcomeKind = ResponseOutcome['kind'];

export const responseSchema = z.object({
  id: z.string(),
  label: z.string().default('Continue'),
  /** Saved per player when chosen; usable later via the "has flag" condition. */
  flag: z.string().default(''),
  conditions: z.array(primitiveInstanceSchema).default([]),
  actions: z.array(primitiveInstanceSchema).default([]),
  outcome: responseOutcomeSchema.default({ kind: 'end' }),
});

export type ResponseDefinition = z.infer<typeof responseSchema>;

/** A dialogue node carries its own ordered list of responses in `data`. */
export const conversationNodeSchema = graphNodeSchema.extend({
  data: z
    .object({
      speaker: z.string().default(''),
      body: z.string().default(''),
      font: z.string().default('default'),
      typewriterCps: z.number().default(30),
      voiceLineKey: z.string().default(''),
      delayTicks: z.number().default(0),
      responses: z.array(responseSchema).default([]),
    })
    .passthrough(),
});

export const conversationSchema = z.object({
  id: z.string(),
  name: z.string(),
  startNodeId: z.string().optional(),
  nodes: z.array(conversationNodeSchema).default([]),
  /** Legacy graph edges. Retained optional so pre-migration drafts still parse. */
  edges: z.array(graphEdgeSchema).default([]),
});

export type ConversationDefinition = z.infer<typeof conversationSchema>;

export function makeDefaultConversation(id: string, name: string) {
  return { id, name, nodes: [], edges: [] };
}
