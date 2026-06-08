import { z } from 'zod';

/** Shared zod fragments for graph-shaped content (saga, quest, conversation). */
export const positionSchema = z.object({ x: z.number(), y: z.number() });

export const graphNodeSchema = z.object({
  id: z.string(),
  kind: z.string(),
  position: positionSchema,
  data: z.record(z.unknown()).default({}),
});

export const graphEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  data: z.record(z.unknown()).default({}),
});

export const primitiveInstanceSchema = z.object({
  id: z.string(),
  type: z.string(),
  params: z.record(z.unknown()).default({}),
});

export type PrimitiveInstanceData = z.infer<typeof primitiveInstanceSchema>;
