-- Purity / rune-slot tuning tables (game-owned config, edited in this console).
-- Mirrors the game's Flyway migration. Each row holds a JSON `definition` the
-- game deserializes directly. Seed data lives in the game migration; the console
-- only reads/writes rows.

CREATE TABLE IF NOT EXISTS purity_distributions (
  name        text PRIMARY KEY,
  definition  jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purity_reforge_bias (
  purity      text PRIMARY KEY,
  definition  jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purity_rune_slot_distributions (
  purity      text PRIMARY KEY,
  definition  jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
