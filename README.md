# Meridian — flight search

Phase 1: project setup, design system, home page, flight search form.
No supplier integration yet; the form navigates to a validated `/search` route
that Phase 2 will wire to the Duffel sandbox.

`Meridian` is a placeholder name — swap it in `src/app/layout.tsx`.

## Running it

```bash
npm install
cp .env.example .env.local   # nothing required yet
npm run dev
```

Open http://localhost:3000.

## Scripts

| Command             | Does                                  |
| ------------------- | ------------------------------------- |
| `npm run dev`       | Dev server (Turbopack)                |
| `npm run build`     | Production build; fails on type errors |
| `npm run lint`      | ESLint                                |
| `npm run typecheck` | `tsc --noEmit`                        |
| `npm run format`    | Prettier                              |

## Layout

```
src/
  app/          Routes. Server Components unless marked otherwise.
  components/   Cross-feature UI. Knows nothing about flights.
  features/     Vertical slices. Owns its types, schema, data and UI.
  lib/          Framework-adjacent helpers (env, fonts, cn).
  types/        Types shared across more than one feature.
```

The rule: `components/` may not import from `features/`. `features/` may import
from `components/` and `lib/`. Business logic never lives in a component file.

See `ARCHITECTURE.md` for the decisions behind all of this.

## What's deliberately missing

- Duffel — Phase 2.
- Supabase — Phase 2 (search persistence), Phase 3 (auth).
- Stripe — Phase 4, and not before ADR on merchant of record is written.
- Tests — Vitest + Playwright arrive with the Duffel adapter, which is the
  first code worth testing.
