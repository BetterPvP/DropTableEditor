-- ─────────────────────────────────────────────────────────────────────────
-- 002_content.sql — The generalized content backbone.
--
-- Every authored artifact (loot_table, saga, quest, conversation, cinematic)
-- is a single `content` row carrying a `draft` (editor-owned) and `published`
-- (game-owned, read-only to the game) JSONB pair.
--
--   • Writers only ever mutate `draft`.
--   • The GAME only ever reads `published`.
--   • Publishing validates the draft, copies draft -> published, bumps
--     `version`, writes a content_snapshots row, and emits
--     pg_notify('content_published', id) so the game can hot-reload.
--   • `revision` is an optimistic-lock counter bumped on every draft save.
--
-- CONTRACT NOTE: reproduce as a core Flyway migration when the game is built.
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS content (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type         text NOT NULL,
  name         text NOT NULL,
  description  text,
  status       text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  draft        jsonb NOT NULL DEFAULT '{}'::jsonb,
  published    jsonb,
  version      integer NOT NULL DEFAULT 0,
  revision     integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   uuid,
  published_at timestamptz,
  published_by uuid
);

CREATE INDEX IF NOT EXISTS content_type_status_idx ON content (type, status);
CREATE INDEX IF NOT EXISTS content_updated_at_idx ON content (updated_at DESC);

-- Immutable version history. A snapshot is written on every publish, and is the
-- unit of rollback (copy payload back into content.published).
CREATE TABLE IF NOT EXISTS content_snapshots (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  version    integer NOT NULL,
  payload    jsonb NOT NULL,
  label      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE INDEX IF NOT EXISTS content_snapshots_content_idx
  ON content_snapshots (content_id, created_at DESC);

-- Derived adjacency cache for cross-reference queries ("which quests use this
-- loot table"). Rebuilt from published JSONB on publish; NOT authoritative.
-- to_content_id is intentionally NOT a FK so a reference may be authored before
-- its target exists.
CREATE TABLE IF NOT EXISTS content_links (
  from_content_id uuid NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  to_content_id   uuid NOT NULL,
  kind            text NOT NULL,
  PRIMARY KEY (from_content_id, to_content_id, kind)
);

CREATE INDEX IF NOT EXISTS content_links_to_idx ON content_links (to_content_id);
