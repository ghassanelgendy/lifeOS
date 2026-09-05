# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

lifeOS is a personal life-management web app (tasks, habits, calendar, finance, health/sleep, screentime, notes, Quran/Azkar) built with React 19 + TypeScript + Vite, backed by Supabase (Postgres + Auth + Edge Functions), with React Query for data/caching. It ships as a PWA, a Capacitor iOS app, a desktop app (Pake/Tauri wrapper), and a browser extension.

## Commands

- `pnpm dev` — run the web dev server (Vite, port 5173)
- `pnpm dev:ios` / `pnpm dev:pake` — run dev server targeting the iOS or Pake (desktop) platform variant
- `pnpm build` / `pnpm build:ios` / `pnpm build:pake` — production builds per platform
- `pnpm build:extension` — build the browser extension (`scripts/build-extension.js`)
- `pnpm test` — run all tests once (Vitest)
- `pnpm test:watch` — Vitest watch mode
- Run a single test file: `pnpm exec vitest run src/lib/utils.test.ts`
- `pnpm typecheck` — `tsc --noEmit`
- `pnpm lint` — runs `scripts/lint.mjs`, which invokes `eslint src` (it auto-skips itself if the installed TypeScript is 7.x, since typescript-eslint doesn't support it yet — don't "fix" this by downgrading TS)

There is no separate CI lint/test gate script beyond the above; typecheck + lint + test are the three checks to run before considering a change done.

## Architecture

### Platform-variant file resolution (`.platform` imports)

This is the most important structural convention in the codebase. Many routes, hooks, and components have per-platform implementations that are all imported through a fake `.platform` extension, e.g.:

```ts
// src/hooks/useTasks.ts
export * from './useTasks.platform';
```

A Vite/Vitest plugin (`platformResolvePlugin` in `vite.config.ts` and `vitest.config.ts`) rewrites `.platform` at resolve time based on the active mode:
- `mode=ios` → resolves to `*.ios.ts(x)`
- `mode=pake` → resolves to `*.pake.ts(x)` if it exists, otherwise falls back to `*.web.ts(x)`
- anything else (default web/PWA) → resolves to `*.web.ts(x)`

The same plugin also rewrites bare `index.css` imports to `index.web.css` / `index.ios.css` / `index.pake.css` (falling back to web for pake if no pake-specific stylesheet exists).

When adding or changing platform-specific behavior, look for all three variants (`Foo.web.tsx`, `Foo.ios.tsx`, `Foo.pake.tsx`) before assuming there's only one implementation — grep for the base name across `src/` rather than editing just the file you happened to open. Not every file has all three variants; pake silently falls back to web, but ios does not fall back automatically (an ios build importing a `.platform` path with no `.ios` file will fail to resolve).

### Data layer

- `src/lib/supabase.ts` creates the Supabase client. Real persisted data (tasks, habits, calendar, finance, health, etc.) lives in Postgres via Supabase, queried/mutated through per-domain hooks in `src/hooks/` (e.g. `useTasks`, `useHabits`, `useFinance`, `useCalendar`) using React Query (`src/lib/queryClient.ts`).
- `src/db/database.ts` and `src/db/indexedDb.ts` are a separate localStorage/IndexedDB-backed store — treat these as legacy/offline-cache concerns, not the primary source of truth.
- `src/lib/offlineSync.ts` handles queuing writes made while offline and draining them on reconnect.
- Server-side logic lives in two places: `api/` (Vercel serverless functions — auth callbacks, calendar feed, AI proxy, cron dispatchers) and `supabase/functions/` (Deno-based Supabase Edge Functions — notification dispatch, SMS/statement ingestion, screentime/sleep/InBody sync, etc). `supabase/migrations/` holds the schema history.

### API egress budget — do not reintroduce polling

The app previously burned through its Supabase egress budget via aggressive polling (10s `handleOnline()` intervals refetching all queries) and duplicate/undeduped requests — see `API_EGRESS_FIX.md` for the full incident writeup. The fix is `src/lib/api-limiter.ts`, a circuit breaker wired in front of the Supabase client (`installApiLimiter()` called before client creation in `supabase.ts`) that deduplicates in-flight requests, rate-limits, tracks estimated egress against a budget, and enters an "emergency mode" that blocks non-critical requests. `queryClient.ts` also overrides `invalidateQueries` to skip invalidation during emergency mode.

When touching networking/sync code:
- Don't add short-interval polling (`setInterval` refetch loops) — React Query's `staleTime`/`gcTime` plus reconnect-triggered refetch is the intended pattern. Current defaults are 30 min stale / 24h gc; don't shorten these without a strong reason.
- Any new Supabase call path should go through the existing client (which the limiter wraps), not a separate fetch.
- Be especially careful with the "heavy" tables (screentime, sleep) — they're intentionally throttled.

### Documentation sync requirement

`.agents/AGENTS.md` states: whenever a feature is added, modified, or retired, `PRD.md`, `CODEBASE_SRS.md`, and `CODEBASE_DOCUMENTATION.md` must be updated to match, because the in-app Wiki (`src/routes/Wiki.tsx`, `src/lib/wikiData.ts`) dynamically extracts content from these files. Treat this as a required step of any feature-level change, not optional cleanup.

### State management

- Cross-cutting client UI state uses Zustand stores in `src/stores/` (e.g. `useUIStore`, `useAzkarStore`, `useFocusSessionStore`, `useWikiStore`).
- Server state (anything backed by Supabase) goes through React Query hooks, not Zustand.

### Routing & shell

- `src/App.tsx` / `src/main.tsx` bootstrap the app; `App.web.tsx` / `App.ios.tsx` are the actual platform entry components (resolved via `.platform`).
- Route components live in `src/routes/`, one per top-level section (Tasks, Habits, Calendar, Finance, Health, Sleep, Screentime, Notes, Analytics, Points, Quran, Azkar, Wiki, Settings, etc.), many with `.web`/`.ios`/`.pake` variants following the convention above.
- Shared UI primitives are in `src/components/ui/`; feature-specific components are grouped under `src/components/<feature>/` (e.g. `analytics/`, `azkar/`, `dashboard/`, `collaboration/`, `wiki/`).

### Native/desktop/extension surfaces

- iOS app: Capacitor (`capacitor.config.json`, `ios/`), built via `pnpm build:ios`.
- Desktop app: Pake/Tauri wrapper (`pake:local` script), built from the `pake` Vite mode.
- Browser extension: `extension/` is a separate, mostly vanilla-JS codebase (its own `manifest.json`, `background.js`, `content.js`, `lib/`) built via `scripts/build-extension.js` — it duplicates a thin Supabase/AI client rather than importing from `src/`.
- Native-only bridging code (haptics, notifications, tray, badge, updater) lives in hooks/libs suffixed `.ios`/`.pake` or in `src/lib/nativeBridge.ts` / `src/lib/otaUpdater.ts`.

### Testing

Vitest + Testing Library + jsdom, configured in `vitest.config.ts` (uses the same `.platform` resolver, pinned to `web`) with setup in `src/setupTests.ts`. Tests are colocated as `*.test.ts`/`*.test.tsx` next to the code they cover (e.g. `src/lib/utils.test.ts`, `src/hooks/useFinance.test.ts`).
