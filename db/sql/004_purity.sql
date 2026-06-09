-- Purity / rune-slot tuning tables (game-owned config, edited in this console).
-- draft -> published split: the console edits `draft`, Publish copies it to
-- `published`, and the game reads `published`. Mirrors the game's Flyway
-- migration; seed data lives there.

CREATE TABLE IF NOT EXISTS purity_distributions (
  name         text PRIMARY KEY,
  draft        jsonb NOT NULL,
  published    jsonb,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);

CREATE TABLE IF NOT EXISTS purity_reforge_bias (
  purity       text PRIMARY KEY,
  draft        jsonb NOT NULL,
  published    jsonb,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);

CREATE TABLE IF NOT EXISTS purity_rune_slot_distributions (
  purity       text PRIMARY KEY,
  draft        jsonb NOT NULL,
  published    jsonb,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);
