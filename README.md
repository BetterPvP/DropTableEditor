# BetterPvP Admin Console

Authoring console for BetterPvP content: **drop tables, storylines (sagas), quests, conversations, and cinematics**. Next.js App Router + shadcn/ui, connected directly to the **game's PostgreSQL** (the single source of truth), with a draft → published boundary the game reads live.

## Architecture in one breath

- Every artifact is one `content` row with a `type` and a `draft`/`published` JSONB pair. Writers edit `draft`; the game reads `published`.
- Publishing validates, copies draft → published, writes a snapshot, and fires `pg_notify('content_published', <id>)` for the game to hot-reload.
- One `/[type]` + `/[type]/[id]` route pair, driven by the content-type registry (`lib/content/registry.ts`).
- Sagas, quests and conversations share one **graph engine** (React Flow). Cinematics use a **timeline** editor. Loot tables use the ported **form** editor.
- Triggers/conditions/actions/requirements/rewards are **self-describing primitives** (`lib/primitives/`) — the inspector renders forms from their specs. Mirrors the game's future `quest_primitives` table.

## Getting started

```bash
cp .env.example .env        # set DATABASE_URL + AUTH_SECRET (npx auth secret)
npm install
npm run db:apply            # create/verify schema from db/sql/*.sql (idempotent)
npm run db:seed-manifest    # dev: fill game_items/zones/npcs/professions/primitives
npm run dev                 # http://localhost:3000
```

Production: `npm run build && npm start`. Tests: `npm test` (Vitest) · `npm run test:e2e` (Playwright).

## Environment

```
DATABASE_URL=postgres://…       # the game's Postgres (shared source of truth)
AUTH_SECRET=…                   # Auth.js v5 secret
AUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_ENV=development
```

## Database & the game contract

`db/sql/*.sql` is the **canonical DDL** (authoring tables + game manifest tables). It is the contract to be reproduced as Flyway migrations in the game's `core` module when the game side is built — the console never migrates the production DB. See `db/README.md`.

## Project structure

```
app/(dashboard)/[type]/...   # generic content index + editor routes (+ /simulate for loot)
app/(auth)/ or app/auth/...  # Auth.js sign-in / sign-up (invite-gated)
components/editor/           # loot form editor, shared header, version history
components/graph/            # React Flow canvas + generic graph editor
components/content/          # saga / quest / conversation / cinematic editors
components/primitives/       # primitive form + list editor
components/simulation/       # loot Monte-Carlo workspace (Web Worker + Recharts)
lib/db/                      # Kysely client + typed repositories
lib/content/                 # registry, per-type schemas, server actions, manifest loader
lib/primitives/              # primitive registry + types
lib/graph/                   # graph types + validation lints
lib/editor/                  # useContentEditor (autosave + publish + delete)
db/sql/                      # canonical DDL (Flyway contract)
```

Routes: `/` landing · `/auth/sign-in|sign-up` · `/loot-tables` `/sagas` `/quests` `/conversations` `/cinematics` (+ `/[id]` editors) · `/reference/items` · `/insights`.

## Notes

- **Auth**: Auth.js v5, Credentials + JWT, invite-gated sign-up. Edge-safe middleware (`auth.config.ts`) is split from the Node config (`auth.ts`).
- **Concurrency**: optimistic locking via a `revision` counter (a stale save prompts reload). Real-time collaboration is deferred.
- **Insights**: content counts + cross-references (from the `content_links` cache) are live; Loki quest funnels activate once the game emits telemetry.
