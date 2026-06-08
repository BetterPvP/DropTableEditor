import { z } from 'zod';
import { graphNodeSchema, graphEdgeSchema } from '../graph-schema';

export const conversationSchema = z.object({
  id: z.string(),
  name: z.string(),
  startNodeId: z.string().optional(),
  nodes: z.array(graphNodeSchema).default([]),
  edges: z.array(graphEdgeSchema).default([]),
});

export type ConversationDefinition = z.infer<typeof conversationSchema>;

export function makeDefaultConversation(id: string, name: string) {
  return { id, name, nodes: [], edges: [] };
}
