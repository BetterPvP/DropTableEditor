# BetterPvP Admin Console (Next.js)

A redesigned administrative console for BetterPvP Clans featuring a glassmorphism dark theme, Supabase-powered auth with invite codes, and a modular loot table editor.

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase project with existing Clans schema
- Environment variables configured in `.env.local`

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### Installation

```
npm install
```

### Development

```
npm run dev
```

Open `http://localhost:3000` in your browser. The app is built with the Next.js App Router and uses SSR with client components only for interactive panels.

### Testing

```
npm test
```

Vitest powers the unit test suite. Playwright is configured for future end-to-end coverage via `npm run e2e`.

## Project Structure

- `app/` – App Router pages with grouped layouts for marketing, auth, and the authenticated console.
- `components/` – shadcn/ui based primitives, layout chrome, and loot editor panels.
- `hooks/use-autosave.ts` – Hybrid autosave hook with debounce, periodic saves, and draft persistence.
- `lib/` – Supabase helpers, sample data loaders, and shared utilities.
- `sample_data/` – Reference loot tables used for schema parity checks.
- `tests/` – Placeholder fixtures for future parity and simulation tests.

## shadcn/ui

The UI kit is based on shadcn. Components were generated manually for this scaffold. You can extend them via the `components/ui` directory. Tailwind tokens are tuned for a dark, glossy space aesthetic.

## Supabase & Auth

Auth flows use Supabase JS via server actions. Signup enforces invite codes stored in an `invite_codes` table. On success the code is marked as used and the user is redirected to the loot table workspace.

## Simulation

The editor currently displays mocked simulation data while the Monte Carlo worker implementation is being integrated. The drawer UI, controls, and result scaffolding are in place.

## Export Parity

Sample loot tables in `sample_data/` are loaded by the editor to ensure JSON preview parity. Future tests should assert that exports remain byte-identical to legacy output using Vitest fixtures.

## Accessibility & Shortcuts

- Glassmorphism surfaces respect the reduce-transparency toggle in the side navigation.
- Buttons, navigation, and command palette include keyboard focus styles.
- Planned shortcuts: `⌘/Ctrl + S` (save), `⌘/Ctrl + Enter` (simulate), `[` `]` (cycle tabs), `/` (command palette).

## Deployment

Deploy to Vercel or any Node-capable platform. Ensure Supabase environment variables are configured and the `invite_codes` table exists with appropriate RLS policies.

