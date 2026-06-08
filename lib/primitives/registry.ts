import type { PrimitiveCategory, PrimitiveDescriptor, ParamSpecs } from './types';

/**
 * Built-in primitive registry. Kept deliberately broad so storywriters have a
 * useful palette before the game defines its own. The game will eventually
 * supersede/extend this via the quest_primitives table.
 */
export const PRIMITIVES: PrimitiveDescriptor[] = [
  // ── Triggers ────────────────────────────────────────────────────────────
  { id: 'trigger.zone_enter', category: 'trigger', label: 'Enter zone', params: { zone: { type: 'zone_ref', required: true } } },
  { id: 'trigger.zone_exit', category: 'trigger', label: 'Exit zone', params: { zone: { type: 'zone_ref', required: true } } },
  { id: 'trigger.kill', category: 'trigger', label: 'Kill entity', params: { entityType: { type: 'string', label: 'Entity type' }, count: { type: 'int', default: 1 } } },
  { id: 'trigger.harvest', category: 'trigger', label: 'Harvest resource', params: { profession: { type: 'profession_ref' }, count: { type: 'int', default: 1 } } },
  { id: 'trigger.fish_caught', category: 'trigger', label: 'Catch fish', params: { count: { type: 'int', default: 1 } } },
  { id: 'trigger.profession_xp', category: 'trigger', label: 'Gain profession XP', params: { profession: { type: 'profession_ref' }, amount: { type: 'int', default: 1 } } },
  { id: 'trigger.npc_interact', category: 'trigger', label: 'Talk to NPC', params: { npc: { type: 'npc_ref', required: true } } },
  { id: 'trigger.reach_location', category: 'trigger', label: 'Reach location', params: { zone: { type: 'zone_ref' } } },
  { id: 'trigger.item_acquire', category: 'trigger', label: 'Acquire item', params: { item: { type: 'item_ref', required: true }, count: { type: 'int', default: 1 } } },

  // ── Conditions / Requirements (same shape; category differs by use) ───────
  { id: 'condition.clan_level', category: 'condition', label: 'Clan level ≥', params: { level: { type: 'int', default: 1 } } },
  { id: 'condition.profession_level', category: 'condition', label: 'Profession level ≥', params: { profession: { type: 'profession_ref' }, level: { type: 'int', default: 1 } } },
  { id: 'condition.has_item', category: 'condition', label: 'Has item', params: { item: { type: 'item_ref', required: true }, count: { type: 'int', default: 1 } } },
  { id: 'condition.in_zone', category: 'condition', label: 'In zone', params: { zone: { type: 'zone_ref', required: true } } },
  { id: 'condition.quest_completed', category: 'condition', label: 'Quest completed', params: { quest: { type: 'content_ref', contentType: 'quest', required: true } } },
  { id: 'condition.expression', category: 'condition', label: 'Expression (JEXL)', params: { expression: { type: 'jexl', required: true } } },

  { id: 'requirement.clan_level', category: 'requirement', label: 'Requires clan level ≥', params: { level: { type: 'int', default: 1 } } },
  { id: 'requirement.profession_level', category: 'requirement', label: 'Requires profession level ≥', params: { profession: { type: 'profession_ref' }, level: { type: 'int', default: 1 } } },
  { id: 'requirement.quest_completed', category: 'requirement', label: 'Requires quest completed', params: { quest: { type: 'content_ref', contentType: 'quest', required: true } } },

  // ── Actions ───────────────────────────────────────────────────────────────
  { id: 'action.give_item', category: 'action', label: 'Give item', params: { item: { type: 'item_ref', required: true }, amount: { type: 'int', default: 1 } } },
  { id: 'action.give_xp', category: 'action', label: 'Give XP', params: { profession: { type: 'profession_ref' }, amount: { type: 'int', default: 100 } } },
  { id: 'action.give_clan_energy', category: 'action', label: 'Give clan energy', params: { amount: { type: 'int', default: 1 } } },
  { id: 'action.play_sound', category: 'action', label: 'Play sound', params: { key: { type: 'string' }, volume: { type: 'float', default: 1 }, pitch: { type: 'float', default: 1 } } },
  { id: 'action.send_message', category: 'action', label: 'Send message', params: { message: { type: 'text' } } },
  { id: 'action.start_conversation', category: 'action', label: 'Start conversation', params: { conversation: { type: 'content_ref', contentType: 'conversation', required: true } } },
  { id: 'action.start_cinematic', category: 'action', label: 'Start cinematic', params: { cinematic: { type: 'content_ref', contentType: 'cinematic', required: true } } },
  { id: 'action.spawn_npc', category: 'action', label: 'Spawn NPC', params: { npc: { type: 'npc_ref', required: true }, zone: { type: 'zone_ref' } } },
  { id: 'action.fire_event', category: 'action', label: 'Fire event', params: { key: { type: 'string', required: true } } },
  { id: 'action.teleport', category: 'action', label: 'Teleport', params: { zone: { type: 'zone_ref', required: true } } },

  // ── Rewards ─────────────────────────────────────────────────────────────
  { id: 'reward.loot_table', category: 'reward', label: 'Roll loot table', params: { lootTable: { type: 'content_ref', contentType: 'loot_table', required: true } } },
  { id: 'reward.item', category: 'reward', label: 'Item', params: { item: { type: 'item_ref', required: true }, amount: { type: 'int', default: 1 } } },
  { id: 'reward.xp', category: 'reward', label: 'XP', params: { profession: { type: 'profession_ref' }, amount: { type: 'int', default: 100 } } },
  { id: 'reward.unlock_quest', category: 'reward', label: 'Unlock quest', params: { quest: { type: 'content_ref', contentType: 'quest', required: true } } },
];

export function primitivesByCategory(category: PrimitiveCategory): PrimitiveDescriptor[] {
  return PRIMITIVES.filter((p) => p.category === category);
}

export function primitiveById(id: string): PrimitiveDescriptor | undefined {
  return PRIMITIVES.find((p) => p.id === id);
}

export function defaultParams(specs: ParamSpecs): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, spec] of Object.entries(specs)) {
    if (spec.default !== undefined) out[key] = spec.default;
    else if (spec.type === 'boolean') out[key] = false;
    else if (spec.type === 'int' || spec.type === 'float') out[key] = 0;
    else out[key] = '';
  }
  return out;
}
