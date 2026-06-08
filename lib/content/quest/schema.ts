import { z } from 'zod';
import { graphNodeSchema, graphEdgeSchema, primitiveInstanceSchema } from '../graph-schema';

export const questTypes = ['major', 'side', 'objective', 'hidden'] as const;
export const questScopes = ['solo', 'party', 'clan', 'alliance', 'server'] as const;

export const questSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  questType: z.enum(questTypes).default('side'),
  scope: z.enum(questScopes).default('solo'),
  requirements: z.array(primitiveInstanceSchema).default([]),
  rewards: z.array(primitiveInstanceSchema).default([]),
  // The stage graph: nodes = stages, edges = transitions (with guard conditions).
  nodes: z.array(graphNodeSchema).default([]),
  edges: z.array(graphEdgeSchema).default([]),
});

export type QuestDefinition = z.infer<typeof questSchema>;

export function makeDefaultQuest(id: string, name: string) {
  return {
    id, name, questType: 'side', scope: 'solo',
    requirements: [], rewards: [], nodes: [], edges: [],
  };
}
