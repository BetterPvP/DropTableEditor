# Database — canonical DDL (the game-Flyway contract)

The `db/sql/*.sql` files are the **single canonical definition** of the
authoring + manifest schema. They are applied in filename order.

```bash
cp .env.example .env        # set DATABASE_URL
npm run db:apply            # create/verify all tables (idempotent)
npm run db:seed-manifest    # fill game_items/zones/npcs/professions/primitives for dev
```

## Ownership & the contract

The admin console connects directly to the **BetterPvP game's PostgreSQL**.
There is exactly one source of truth.

- **Authoring tables** (`content`, `content_snapshots`, `content_links`) are
  written by this console and read by the game.
- **Manifest tables** (`game_*`, `quest_primitives`) are written by the **game**
  on boot and treated as read-only here. The `db:seed-manifest` script only
  exists so the console is usable before the game side ships; retire it then.

When the game module is built, **reproduce these files verbatim** as Flyway
migrations under `core/src/main/resources/core-migrations/postgres/`. The
console must never run migrations against the production game database — every
statement here uses `IF NOT EXISTS`, but schema ownership belongs to Flyway.

## The draft → published boundary

`content` carries both a `draft` (editor) and `published` (game) JSONB blob.
Writers only mutate `draft`; the game only reads `published`. Publishing copies
`draft → published`, bumps `version`, snapshots the payload, and fires
`pg_notify('content_published', <id>)`. The game `LISTEN`s and hot-reloads.
`revision` is the optimistic-lock counter for concurrent draft saves.
