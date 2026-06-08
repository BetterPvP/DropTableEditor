-- ─────────────────────────────────────────────────────────────────────────
-- 003_manifest.sql — Game "manifest" (reference) tables.
--
-- These describe live game state the console references but does NOT own:
-- registered items, zones, NPCs, professions, and the self-describing quest
-- primitives (triggers / conditions / actions / requirements / rewards).
--
-- OWNERSHIP: When the game side is built, the SERVER populates these on boot
-- (and on reload) — it is the source of truth. The console treats them as
-- READ-ONLY for autocomplete + reference validation. Until then, the
-- `db:seed-manifest` dev script fills them so editors are usable.
--
-- This is what lets us delete the old hand-curated item registry: item
-- identity is owned by the game, and the console validates references against
-- game_items rather than renaming strings across tables.
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS game_items (
  key          text PRIMARY KEY,
  display_name text NOT NULL,
  source       text NOT NULL DEFAULT 'vanilla' CHECK (source IN ('vanilla', 'custom')),
  material     text,
  tags         text[] NOT NULL DEFAULT '{}',
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS game_zones (
  key          text PRIMARY KEY,
  display_name text NOT NULL,
  world        text,
  tags         text[] NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS game_npcs (
  key          text PRIMARY KEY,
  display_name text NOT NULL,
  type         text
);

CREATE TABLE IF NOT EXISTS game_professions (
  key          text PRIMARY KEY,
  display_name text NOT NULL,
  max_level    integer
);

-- Self-describing primitives. param_schema is a JSON description of the
-- primitive's parameters; ui carries optional rendering hints. The console
-- renders inspector forms from these rows (falling back to its built-in
-- TypeScript primitive registry until the game serves them).
CREATE TABLE IF NOT EXISTS quest_primitives (
  id           text PRIMARY KEY,
  category     text NOT NULL CHECK (category IN ('trigger', 'condition', 'action', 'requirement', 'reward')),
  label        text NOT NULL,
  param_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  ui           jsonb NOT NULL DEFAULT '{}'::jsonb
);
