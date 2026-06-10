-- Quest-giver NPC definitions (authored here) + the game's factory manifest.
-- Placement is via Mapper data-points named with a quest NPC id; this carries
-- appearance + interaction. game_npc_factories is written by the game on boot
-- (read-only here) and drives the NPC-source picker.

CREATE TABLE IF NOT EXISTS quest_npcs (
  id             text PRIMARY KEY,
  display_name   text NOT NULL DEFAULT 'NPC',
  kind           text,            -- conversation | quest
  content_id     text,
  source         text NOT NULL DEFAULT 'human',  -- factory | human
  factory        text,
  type           text,
  skin_value     text,
  skin_signature text,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS game_npc_factories (
  factory text NOT NULL,
  type    text NOT NULL,
  PRIMARY KEY (factory, type)
);
