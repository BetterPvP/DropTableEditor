# BetterPvP Admin Console (Next.js)

Modernized administration console for the BetterPvP **Clans** loot table tooling. This repository contains a Next.js App Router implementation that embraces server-first rendering, shadcn/ui components, Supabase auth, and a dark glassmorphism aesthetic inspired by JetBrains IDEs.

## Getting Started

### Prerequisites
- Node.js 18+
- npm 9+
- Supabase project with existing BetterPvP schema

### Installation
```bash
npm install
```

### Development
```bash
npm run dev
```

The development server starts on [http://localhost:3000](http://localhost:3000). Hot reloading is enabled.

### Production Build
```bash
npm run build
npm start
```

### Tests
- Unit & integration: `npm test`
- Playwright e2e: `npm run test:e2e`

## Environment Variables
Create a `.env.local` file with the following variables:
```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-key
NEXT_PUBLIC_APP_ENV=development
```

## Project Structure
```
app/                # App Router routes (SSR-first)
components/         # shadcn-style UI primitives & feature components
lib/                # Utilities, hooks, and sample data
supabase/           # Client/server Supabase helpers
sample_data/        # Legacy loot table fixtures for parity validation
```

Key routes:
- `/` – Landing page with hero and tools showcase
- `/auth/sign-in`, `/auth/sign-up` – Supabase auth with invite code enforcement (stubbed API handler)
- `/loot-tables` – Searchable index
- `/loot-tables/[id]` – Three-pane editor shell with autosave, inspector, and simulation drawer placeholder
- `/loot-tables/new` – Draft creator experience using hybrid autosave
- `/settings` – Account preferences stub

## Styling & Components
- Tailwind CSS + CSS variables for glassmorphism
- shadcn-inspired components (`button`, `badge`, `card`, etc.)
- Theme controls include a “Reduce glass” accessibility toggle stored in `localStorage`

## Autosave Hook
`useAutosave` implements a hybrid strategy combining debounce, on-blur, periodic, and before-unload saves while persisting crash-safe drafts to `localStorage`.

## Simulation Worker (placeholder)
The UI includes a simulation drawer entry point. The worker and metrics engine can be implemented in `components/simulation` alongside a `simulation.worker.ts` module.

## Invite Codes API (stub)
`/api/invite/validate` currently validates against a static allow list (`ADMIN-1234`, `DEV-SPACE`). Replace with Supabase-backed validation plus RLS enforcement in production.

## Legacy Schema Parity
Sample loot tables from the original Vite editor live under `sample_data/`. Use them for parity tests ensuring exported JSON remains byte-identical.

## Tooling Notes
- TanStack Query handles client-side fetching
- Zod powers form validation and API route guards
- Recharts, Web Workers, and deeper Supabase integration are ready to be wired into the new structure

## License
Internal BetterPvP tooling – not for public redistribution.
