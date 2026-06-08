import type { ColumnType, Generated } from 'kysely';

/**
 * Kysely schema for the BetterPvP game Postgres. Hand-written to mirror
 * db/sql/*.sql exactly. JSONB columns are written as stringified JSON (the
 * repositories JSON.stringify on write) and come back parsed by node-postgres
 * on read — hence `ColumnType<parsed, string, string>`.
 */

export type ContentType = 'loot_table' | 'saga' | 'quest' | 'conversation' | 'cinematic';
export type ContentStatus = 'draft' | 'published' | 'archived';
export type UserRole = 'editor' | 'admin';

type Jsonb<TSelect> = ColumnType<TSelect, string, string>;
type CreatedAt = ColumnType<Date, Date | string | undefined, never>;
type UpdatedAt = ColumnType<Date, Date | string | undefined, Date | string>;

export interface ContentTable {
  id: Generated<string>;
  type: string;
  name: string;
  description: string | null;
  status: ColumnType<ContentStatus, ContentStatus | undefined, ContentStatus>;
  draft: Jsonb<unknown>;
  published: ColumnType<unknown | null, string | null, string | null>;
  version: Generated<number>;
  revision: Generated<number>;
  created_at: CreatedAt;
  created_by: string | null;
  updated_at: UpdatedAt;
  updated_by: string | null;
  published_at: ColumnType<Date | null, Date | string | null, Date | string | null>;
  published_by: string | null;
}

export interface ContentSnapshotTable {
  id: Generated<string>;
  content_id: string;
  version: number;
  payload: Jsonb<unknown>;
  label: string | null;
  created_at: CreatedAt;
  created_by: string | null;
}

export interface ContentLinkTable {
  from_content_id: string;
  to_content_id: string;
  kind: string;
}

export interface GameItemTable {
  key: string;
  display_name: string;
  source: ColumnType<'vanilla' | 'custom', 'vanilla' | 'custom' | undefined, 'vanilla' | 'custom'>;
  material: string | null;
  tags: ColumnType<string[], string[] | undefined, string[]>;
  updated_at: UpdatedAt;
}

export interface GameZoneTable {
  key: string;
  display_name: string;
  world: string | null;
  tags: ColumnType<string[], string[] | undefined, string[]>;
}

export interface GameNpcTable {
  key: string;
  display_name: string;
  type: string | null;
}

export interface GameProfessionTable {
  key: string;
  display_name: string;
  max_level: number | null;
}

export interface QuestPrimitiveTable {
  id: string;
  category: 'trigger' | 'condition' | 'action' | 'requirement' | 'reward';
  label: string;
  param_schema: Jsonb<Record<string, unknown>>;
  ui: Jsonb<Record<string, unknown>>;
}

export interface UserTable {
  id: Generated<string>;
  name: string | null;
  email: string | null;
  emailVerified: ColumnType<Date | null, Date | string | null, Date | string | null>;
  image: string | null;
  password_hash: string | null;
  role: ColumnType<UserRole, UserRole | undefined, UserRole>;
  created_at: CreatedAt;
}

export interface InviteCodeTable {
  code: string;
  role: ColumnType<UserRole, UserRole | undefined, UserRole>;
  created_by: string | null;
  created_at: CreatedAt;
  used_at: ColumnType<Date | null, Date | string | null, Date | string | null>;
  used_by: string | null;
}

export interface Database {
  content: ContentTable;
  content_snapshots: ContentSnapshotTable;
  content_links: ContentLinkTable;
  game_items: GameItemTable;
  game_zones: GameZoneTable;
  game_npcs: GameNpcTable;
  game_professions: GameProfessionTable;
  quest_primitives: QuestPrimitiveTable;
  users: UserTable;
  invite_codes: InviteCodeTable;
  // Auth.js adapter tables (present for future OAuth; unused by the JWT/Credentials flow).
  accounts: {
    id: Generated<string>;
    userId: string;
    type: string;
    provider: string;
    providerAccountId: string;
    refresh_token: string | null;
    access_token: string | null;
    expires_at: number | null;
    id_token: string | null;
    scope: string | null;
    session_state: string | null;
    token_type: string | null;
  };
  sessions: {
    id: Generated<string>;
    userId: string;
    expires: ColumnType<Date, Date | string, Date | string>;
    sessionToken: string;
  };
}
