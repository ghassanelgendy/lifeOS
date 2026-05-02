# lifeOS

LifeOS is a personal operating system: one place to run your day-to-day life (tasks, habits, focus sessions, sleep, screentime, calendar, finance, analytics) with a fast UI and a Supabase-backed sync layer.

## Demo

Live: `https://life-os-tan.vercel.app`

## Mission

Turn “I should…” into **a concrete, calm plan** — and keep it close enough to reality that you’ll actually follow it.

## Vision

An OS for your life where your **intent** (plans) and your **evidence** (what happened) live together — so you can iterate on your routines with the same clarity you use to ship software.

## What changes for you

lifeOS is built for the problem that most tools avoid: **your life is multi-domain**, but your execution still needs to feel like one system.

- **One home for execution**: tasks + habits + schedule + key signals in one place, so you stop context-switching.
- **A tighter feedback loop**: plan the week → run today → review trends (sleep/screentime/finance/habits) → adjust.
- **Less UI tax**: the same “details sheet” pattern across modules, so managing your system stays fast.
- **Your metrics stay yours**: user-scoped analytics and auth boundaries (not shared averages leaking between users).
- **Fits your workflow**: web-first, with PWA + desktop (Tauri) options.

This repo is a **React + Vite + TypeScript** app, deployed on **Vercel**, with data stored in **Supabase**. It also supports a **PWA** service worker and a **Tauri** desktop build.

[![React](https://img.shields.io/badge/React-19-149eca?logo=react&logoColor=white)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript&logoColor=white)](#)
[![Vite](https://img.shields.io/badge/Vite-7-646cff?logo=vite&logoColor=white)](#)
[![Supabase](https://img.shields.io/badge/Supabase-db%20%2B%20auth%20%2B%20edge-3ecf8e?logo=supabase&logoColor=white)](#)
[![Vercel](https://img.shields.io/badge/Vercel-deploy-000000?logo=vercel&logoColor=white)](#)
[![PWA](https://img.shields.io/badge/PWA-enabled-5a0fc8?logo=pwa&logoColor=white)](#)
[![Tauri](https://img.shields.io/badge/Tauri-desktop-24c8db?logo=tauri&logoColor=white)](#)

---

## Features (full list)

- **Dashboard**
  - Quick-view “Today” metrics and daily overview
  - Strategic + annual review panels
- **Tasks**
  - Smart views: Today / Week / Upcoming / All / Completed / Won’t-do
  - Lists and tags
  - Details editing via bottom sheet (scrollable)
  - TickTick integration routes (sync + pull)
- **Habits**
  - Daily + weekly habits
  - Habit logs and streaks
  - Adherence % tracking
  - Habit editing uses the same bottom-sheet details UX pattern
  - Prayer habit tracking + notifications plumbing (Supabase Edge Functions)
- **Weekly planner**
  - Week-at-a-glance planning by day (Sunday start)
  - Adds planner items + creates real tasks due on that day
- **Focus**
  - Focus sessions and tracking
- **Sleep**
  - Sleep sessions + trends
  - Upload path via Supabase Edge Function
- **Screentime**
  - Daily summaries
  - Apps + websites breakdown
  - Upload path via Supabase Edge Function
- **Calendar**
  - Calendar events
  - iCal subscription support
- **Finance**
  - Transactions
  - Budgets + summaries
  - SMS ingestion pipeline (Supabase function)
- **Analytics**
  - Cross-domain trend dashboards (habits/tasks/sleep/screentime/finance)

---

## Tech stack (practical)

- **Frontend**: React 19, React Router, TypeScript
- **UI**: Tailwind utilities + repo UI primitives in `src/components/ui/*`
- **State**: Zustand (`src/stores/*`)
- **Data**: Supabase (`src/lib/supabase.ts`) + React Query caching
- **Deploy**: Vercel (`vercel.json`)
- **Supabase**:
  - migrations in `supabase/migrations/`
  - edge functions in `supabase/functions/`
- **PWA**: `src/sw.ts` + `vite-plugin-pwa`
- **Desktop**: Tauri in `src-tauri/`

---

## Getting started (local dev)

### Prereqs
- Node.js (recommended: latest LTS)
- npm

### Install

```bash
npm install
```

### Run dev server

```bash
npm run dev
```

### Lint

```bash
npm run lint
```

### Build

```bash
npm run build
```

---

## Environment variables

There are two common “lanes”:

- **Frontend (Vite)**: variables prefixed with `VITE_` are bundled for the client.
- **Serverless / edge**: Supabase Edge Functions (Deno) use Supabase secrets; Vercel API routes use Vercel env vars.

The repo includes `.env.example` as a starting point.

---

## Repo structure

```text
src/
  components/         # feature components + UI
  components/ui/      # shared UI primitives (sheets, inputs, buttons, etc.)
  routes/             # pages
  hooks/              # data fetching + domain hooks
  stores/             # Zustand stores
  lib/                # shared utilities + integrations
  db/                 # local/offline helpers and seeding
supabase/
  migrations/         # schema + RLS changes
  functions/          # Edge Functions (Deno)
api/                  # Vercel serverless handlers
src-tauri/            # desktop build
```

---

## Conventions (how to contribute)

- Prefer reusing existing hooks/components over creating near-duplicates.
- Keep authz/security server-side (Supabase RLS + server routes); UI checks are UX only.
- Keep changes small and easy to review.

---

## License

Private for now (until you decide otherwise).

