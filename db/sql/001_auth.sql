-- ─────────────────────────────────────────────────────────────────────────
-- 001_auth.sql — Authentication tables for the admin console.
--
-- CONTRACT NOTE: These tables are owned by the admin console for now. When the
-- game side is built, reproduce this DDL as a Flyway migration in
-- core/src/main/resources/core-migrations/postgres/. The console must never run
-- migrations against the production game database — it only reads/writes rows.
--
-- Layout follows the Auth.js (@auth/pg-adapter) standard schema so OAuth can be
-- added later, extended with password_hash + role for the Credentials flow.
-- ─────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text,
  email           text UNIQUE,
  "emailVerified" timestamptz,
  image           text,
  password_hash   text,
  role            text NOT NULL DEFAULT 'editor' CHECK (role IN ('editor', 'admin')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS accounts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"            uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type                text NOT NULL,
  provider            text NOT NULL,
  "providerAccountId" text NOT NULL,
  refresh_token       text,
  access_token        text,
  expires_at          bigint,
  id_token            text,
  scope               text,
  session_state       text,
  token_type          text,
  UNIQUE (provider, "providerAccountId")
);

CREATE TABLE IF NOT EXISTS sessions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires        timestamptz NOT NULL,
  "sessionToken" text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS verification_token (
  identifier text NOT NULL,
  expires    timestamptz NOT NULL,
  token      text NOT NULL,
  PRIMARY KEY (identifier, token)
);

-- Invite-code gated sign-up (ported from the previous console).
CREATE TABLE IF NOT EXISTS invite_codes (
  code       text PRIMARY KEY,
  role       text NOT NULL DEFAULT 'editor' CHECK (role IN ('editor', 'admin')),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at    timestamptz,
  used_by    uuid REFERENCES users(id) ON DELETE SET NULL
);
