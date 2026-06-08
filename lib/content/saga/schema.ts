import { z } from 'zod';
import { graphNodeSchema, graphEdgeSchema } from '../graph-schema';

export const sagaSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  nodes: z.array(graphNodeSchema).default([]),
  edges: z.array(graphEdgeSchema).default([]),
});

export type SagaDefinition = z.infer<typeof sagaSchema>;

export function makeDefaultSaga(id: string, name: string) {
  return { id, name, nodes: [], edges: [] };
}
