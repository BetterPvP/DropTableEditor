// Seeds the manifest (reference) tables for local development so the editors
// have items/zones/npcs/professions/primitives to autocomplete against.
//
// In production the GAME populates these on boot — this script is a dev stand-in
// and should be retired once the game side ships.
import 'dotenv/config';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env first.');
  process.exit(1);
}

// A representative slice of vanilla materials commonly referenced in loot.
const VANILLA_ITEMS = [
  'minecraft:diamond', 'minecraft:netherite_scrap', 'minecraft:netherite_ingot',
  'minecraft:gold_ingot', 'minecraft:iron_ingot', 'minecraft:copper_ingot',
  'minecraft:emerald', 'minecraft:lapis_lazuli', 'minecraft:redstone',
  'minecraft:coal', 'minecraft:gold_nugget', 'minecraft:iron_nugget',
  'minecraft:experience_bottle', 'minecraft:ender_pearl', 'minecraft:blaze_rod',
  'minecraft:cod', 'minecraft:salmon', 'minecraft:pufferfish', 'minecraft:tropical_fish',
  'minecraft:golden_apple', 'minecraft:enchanted_golden_apple', 'minecraft:totem_of_undying',
  'minecraft:diamond_sword', 'minecraft:diamond_pickaxe', 'minecraft:netherite_sword',
  'minecraft:oak_log', 'minecraft:spruce_log', 'minecraft:stone', 'minecraft:cobblestone',
  'minecraft:deepslate', 'minecraft:raw_copper', 'minecraft:raw_iron', 'minecraft:raw_gold',
];

// Placeholder BetterPvP custom items. The real list comes from core/item later.
const CUSTOM_ITEMS = [
  ['betterpvp:coin_small_nugget', 'Small Gold Nugget', 'GOLD_NUGGET'],
  ['betterpvp:coin_large_nugget', 'Large Gold Nugget', 'GOLD_NUGGET'],
  ['betterpvp:coin_bar', 'Gold Bar', 'GOLD_INGOT'],
  ['betterpvp:energy_shard', 'Energy Shard', 'AMETHYST_SHARD'],
  ['betterpvp:energy_small_crystal', 'Small Energy Crystal', 'AMETHYST_CLUSTER'],
  ['betterpvp:reinforcement_basic', 'Basic Reinforcement', 'IRON_NUGGET'],
];

const ZONES = [
  ['spawn', 'Spawn', 'world'],
  ['north_gate', 'North Gate', 'world'],
  ['fishing_docks', 'Fishing Docks', 'world'],
  ['copper_mine', 'Copper Mine', 'world'],
  ['willow_grove', 'Willow Grove', 'world'],
];

const NPCS = [
  ['foreman_garrick', 'Foreman Garrick', 'HUMAN'],
  ['fisherman_pike', 'Fisherman Pike', 'HUMAN'],
  ['guard_captain', 'Guard Captain', 'HUMAN'],
];

const PROFESSIONS = [
  ['fishing', 'Fishing', 100],
  ['mining', 'Mining', 100],
  ['woodcutting', 'Woodcutting', 100],
];

// A minimal seed of self-describing primitives. The console also ships a
// built-in TypeScript registry; these rows let us prove the DB-driven path.
const PRIMITIVES = [
  ['trigger.zone_enter', 'trigger', 'Enter Zone',
    { zone: { type: 'zone_ref', required: true } }],
  ['trigger.kill', 'trigger', 'Kill Entity',
    { entityType: { type: 'string' }, count: { type: 'int', default: 1 } }],
  ['trigger.harvest', 'trigger', 'Harvest Resource',
    { profession: { type: 'profession_ref' }, count: { type: 'int', default: 1 } }],
  ['condition.clan_level', 'condition', 'Clan Level At Least',
    { level: { type: 'int', default: 1 } }],
  ['condition.profession_level', 'condition', 'Profession Level At Least',
    { profession: { type: 'profession_ref' }, level: { type: 'int', default: 1 } }],
  ['action.give_item', 'action', 'Give Item',
    { item: { type: 'item_ref', required: true }, amount: { type: 'int', default: 1 } }],
  ['action.play_sound', 'action', 'Play Sound',
    { key: { type: 'string' }, volume: { type: 'float', default: 1 }, pitch: { type: 'float', default: 1 } }],
  ['action.start_conversation', 'action', 'Start Conversation',
    { conversation: { type: 'content_ref', contentType: 'conversation' } }],
  ['reward.loot_table', 'reward', 'Roll Loot Table',
    { lootTable: { type: 'content_ref', contentType: 'loot_table' } }],
];

const client = new pg.Client({ connectionString });

async function run() {
  await client.connect();

  for (const key of VANILLA_ITEMS) {
    const name = key.split(':')[1].split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
    await client.query(
      `INSERT INTO game_items (key, display_name, source, material) VALUES ($1, $2, 'vanilla', $3)
       ON CONFLICT (key) DO UPDATE SET display_name = EXCLUDED.display_name, updated_at = now()`,
      [key, name, key.split(':')[1].toUpperCase()],
    );
  }
  for (const [key, name, material] of CUSTOM_ITEMS) {
    await client.query(
      `INSERT INTO game_items (key, display_name, source, material) VALUES ($1, $2, 'custom', $3)
       ON CONFLICT (key) DO UPDATE SET display_name = EXCLUDED.display_name, updated_at = now()`,
      [key, name, material],
    );
  }
  for (const [key, name, world] of ZONES) {
    await client.query(
      `INSERT INTO game_zones (key, display_name, world) VALUES ($1, $2, $3)
       ON CONFLICT (key) DO UPDATE SET display_name = EXCLUDED.display_name`,
      [key, name, world],
    );
  }
  for (const [key, name, type] of NPCS) {
    await client.query(
      `INSERT INTO game_npcs (key, display_name, type) VALUES ($1, $2, $3)
       ON CONFLICT (key) DO UPDATE SET display_name = EXCLUDED.display_name`,
      [key, name, type],
    );
  }
  for (const [key, name, maxLevel] of PROFESSIONS) {
    await client.query(
      `INSERT INTO game_professions (key, display_name, max_level) VALUES ($1, $2, $3)
       ON CONFLICT (key) DO UPDATE SET display_name = EXCLUDED.display_name`,
      [key, name, maxLevel],
    );
  }
  for (const [id, category, label, paramSchema] of PRIMITIVES) {
    await client.query(
      `INSERT INTO quest_primitives (id, category, label, param_schema) VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, param_schema = EXCLUDED.param_schema`,
      [id, category, label, JSON.stringify(paramSchema)],
    );
  }

  console.log(
    `Seeded: ${VANILLA_ITEMS.length + CUSTOM_ITEMS.length} items, ${ZONES.length} zones, ` +
    `${NPCS.length} npcs, ${PROFESSIONS.length} professions, ${PRIMITIVES.length} primitives.`,
  );
}

run()
  .catch((err) => {
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => client.end());
