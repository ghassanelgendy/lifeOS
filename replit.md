# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM (workspace scaffold; app data stored in Supabase)
- **Auth**: Supabase Auth (email/password + Google OAuth)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Application: lifeOS

A personal life operating system dashboard with:
- **Auth**: Supabase Auth (email/password + Google OAuth)
- **Routing**: React Router v7 (BrowserRouter)
- **State**: Zustand stores + TanStack Query with localStorage persistence
- **Offline**: IndexedDB cache + offline queue sync
- **Themes**: Dark/light + 6 accent colors (zinc/blue/green/violet/rose/amber)
- **Integrations**: TickTick task sync (OAuth2), Supabase Realtime, adhan (prayer times)

### Routes
- `/` — Dashboard (default landing, configurable)
- `/tasks` — Task management
- `/focus` — Focus/Pomodoro sessions
- `/health` — Health tracking
- `/habits` — Habit tracker
- `/academics` — Academic tracking
- `/calendar` — Calendar view
- `/notes` — Notes
- `/planner` — Weekly planner
- `/finance` — Finance tracking
- `/screentime` — Screen time tracking
- `/sleep` — Sleep tracking
- `/analytics` — Analytics dashboard
- `/settings` — App settings
- `/login`, `/signup` — Auth pages

### Environment Variables (Secrets)
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (server-side TickTick sync)
- `VITE_TICKTICK_CLIENT_ID` — TickTick OAuth client ID (optional)
- `VITE_TICKTICK_REDIRECT_URI` — TickTick OAuth redirect URI (optional)
- `TICKTICK_CLIENT_SECRET` — TickTick OAuth client secret (optional)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## API Routes (Express server at /api)

- `GET /api/healthz` — health check
- `GET /api/proxy?url=<encoded>` — CORS proxy for external calendar/ICS feeds
