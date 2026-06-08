import type { ContentType } from '@/lib/db/types';

/**
 * Self-describing primitive system. A primitive (trigger/condition/action/
 * requirement/reward) declares its parameters as a spec; the inspector renders
 * a form from that spec. This mirrors the game's planned `quest_primitives`
 * table — the built-in registry is the console's stand-in until the game serves
 * its own. Adding a primitive is a new descriptor, never new form code.
 */
export type PrimitiveCategory = 'trigger' | 'condition' | 'action' | 'requirement' | 'reward';

export type ParamType =
  | 'string'
  | 'text'
  | 'int'
  | 'float'
  | 'boolean'
  | 'enum'
  | 'item_ref'
  | 'zone_ref'
  | 'npc_ref'
  | 'profession_ref'
  | 'content_ref'
  | 'jexl';

export interface ParamSpec {
  type: ParamType;
  label?: string;
  required?: boolean;
  default?: unknown;
  /** For `enum`. */
  options?: string[];
  /** For `content_ref` — which content type to pick from. */
  contentType?: ContentType;
  help?: string;
}

export type ParamSpecs = Record<string, ParamSpec>;

export interface PrimitiveDescriptor {
  id: string;
  category: PrimitiveCategory;
  label: string;
  description?: string;
  params: ParamSpecs;
}

/** A concrete, configured primitive stored in content JSON. */
export interface PrimitiveInstance {
  id: string;
  type: string; // descriptor id
  params: Record<string, unknown>;
}
