# lifeOS — Product Requirements Document (PRD)

## 1) Summary

lifeOS is a unified personal productivity + tracking system. It’s built to help you **plan**, **execute**, and **review** your life across multiple domains (tasks, habits, focus, sleep, screentime, calendar, finance) with a single UI and consistent data model.

The product’s core value is **daily clarity** and **weekly/monthly reflection** with minimal friction.

---

## 2) Goals

- **One home** for day-to-day planning and tracking.
- **Fast** interaction loops (quick add, toggle, review).
- **Consistency**: same patterns across modules (lists, filters, details sheet).
- **Secure-by-default** data isolation (per-user boundaries, RLS in Supabase).
- **Multi-surface** support: web (Vercel), PWA, and desktop (Tauri).

---

## 3) Non-goals (right now)

- Team collaboration / shared workspaces
- Complex billing/subscriptions
- Public profiles
- “Social” features

---

## 4) Primary users

- You (single-user, high customization, personal metrics)
- Secondary: close circle later (optional) but must maintain strict isolation

---

## 5) Core modules (feature requirements)

### 5.1 Dashboard

**Purpose**: “What matters today?” in one screen.

Requirements:
- Show a small set of daily metrics and “due today” rows.
- Keep interactions minimal (no complex editing here).

### 5.2 Tasks

**Purpose**: capture and execute work.

Requirements:
- Smart views: Today / Week / Upcoming / Completed
- Lists + tags
- Fast completion toggles
- Details editing in a bottom sheet (scrollable, single save action)

### 5.3 Habits

**Purpose**: repeatable routines and adherence tracking.

Requirements:
- Daily and weekly habits
- Habit logs per day
- Streaks and adherence %
- Editing uses the same bottom-sheet details UX as tasks

### 5.4 Focus

**Purpose**: track deep work / sessions.

Requirements:
- Start/stop session flows
- Persist session history

### 5.5 Sleep

**Purpose**: track sleep sessions and trends.

Requirements:
- Import/record sleep sessions
- Analytics views for trends

### 5.6 Screentime

**Purpose**: visibility into time spent on apps/web.

Requirements:
- Daily summary
- App/domain breakdown

### 5.7 Calendar

**Purpose**: see scheduled events and time blocks.

Requirements:
- Display calendar events
- iCal subscription support

### 5.8 Finance

**Purpose**: track transactions and budget guardrails.

Requirements:
- Transaction log
- Budgets
- Summaries

### 5.9 Analytics

**Purpose**: review trends across domains.

Requirements:
- Rolling windows (7/30/90 days)
- Per-user analytics only (no cross-user aggregation)

### 5.10 Weekly Planner

**Purpose**: weekly planning by day.

Requirements:
- Week view starting Sunday
- Add lines to each day
- When a “planner line” is added to a day, also create a Task due that day (so it appears in task views)

---

## 6) UX principles

- Use existing UI primitives and patterns (no parallel dialog systems).
- Prefer bottom sheets for “details/edit”.
- Keep screens scannable and calm; avoid noise.
- Accessibility: keyboard nav, focus styles, predictable interactions.

---

## 7) Data + security requirements

- All user data must be isolated by `user_id`.
- Supabase should enforce isolation via **RLS**.
- Edge Functions must not be publicly callable for destructive operations.
- Secrets:
  - never put service role keys in client code
  - cron secrets must be passed via headers (not query params)

---

## 8) Infrastructure & deployment

- Web deployment via Vercel
- Supabase for database, auth, and edge functions
- PWA enabled via `vite-plugin-pwa`
- Optional desktop distribution via Tauri

---

## 9) Success metrics

- Daily use without friction (open → understand → act in < 30 seconds)
- Reliable sync and data correctness
- Trust: no cross-user leakage, no broken auth boundaries

