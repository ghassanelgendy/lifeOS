# lifeOS — Product Requirements Document (PRD)

## 1) Summary

lifeOS is a unified personal productivity + tracking system. It’s built to help you **plan**, **execute**, and **review** your life across multiple domains (tasks, habits, focus, sleep, screentime, calendar, finance) with a single UI and consistent data model.

The product’s core value is **daily clarity** and **weekly/monthly reflection** with minimal friction.

---

## 2) Goals

- **One home** for day-to-day planning and tracking.
- **Fast** interaction loops (quick add, toggle, review) powered by optimistic UI updates for habits, prayers, and tasks to minimize latency perception.
- **Consistency**: same patterns across modules (lists, filters, details sheet).
- **Secure-by-default** data isolation (per-user boundaries, RLS in Supabase, and SSRF mitigation on proxy endpoints).
- **Multi-surface** support: web (Vercel), PWA (with update throttles and loop protection), and native desktop apps (compiled via Pake).

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

### 5.1 Dashboard (Quick View)

**Purpose**: “What matters today?” in one screen.

Requirements:
- **Interactive KPI Cards**: Standardized 2x2 grid layout of key metrics with consistent alignment.
- **24-Hour Circular Progress Clock**:
  - Displays circular progress with animated timeline segments and legend.
  - Interactive timeline markers with name/time tooltips.
  - Blinking vertical current-time indicator bar.
- **Unified Timeline (Due Today)**:
  - Consolidates overdue tasks, today's tasks, daily habits, and calendar events into a single, time-sorted timeline.
  - Incorporates the current prayer row dynamically into the sorted timeline items (sorting incomplete current prayers at the top).
- **Interactive Selectability**:
  - All dashboard items are selectable and open unified details modals.
  - Quick task completion, habit logging, and prayer status toggles directly from the row.
- **Notification Parameter Handling**:
  - Automatically processes URL query parameters (`taskId`, `habitId`, `calendarEventId`, `prayerName`) on load.
  - Auto-opens the corresponding details modal or performs quick-actions (done/postpone).

### 5.2 Tasks

**Purpose**: capture and execute work.

Requirements:
- Smart views: Today / Week / Upcoming / Completed.
- Lists + tags with customizable category colors.
- Fast completion toggles with optimistic UI state updates.
- Details editing in a bottom details sheet or modal (scrollable, single save action).
- **Bi-directional Calendar Sync**: Linked tasks (mapped via `calendar_event_id` or `event:id` keys) automatically sync Title, Description, and Completion Status changes with their linked calendar events in both directions.

### 5.3 Habits

**Purpose**: repeatable routines and adherence tracking.

Requirements:
- Daily and weekly habits with custom color coding.
- Completion logs utilizing canonical timestamps (`completed_at`) for accurate timing.
- **Adherence & Statistics**:
  - Display habit adherence percentage in row subtitles.
  - Surfaces "usual times" based on habit logging history (with minute-level precision).
  - Displays weekly averages and execution stats (current week vs. last week count) in the details modal.
- **Flexibility**: Allow viewing and logging/toggling yesterday's habits (using explicit date parameters).
- Optimistic updates to reduce toggling latency.
- Details editing matches the standard bottom-sheet details UX.

### 5.4 Focus

**Purpose**: track deep work / sessions.

Requirements:
- Start/stop session flows.
- Persist session history.

### 5.5 Sleep

**Purpose**: track sleep sessions and trends.

Requirements:
- **Overhauled Analytics Views**:
  - Stage colors representing sleep cycles (deep, light, REM, awake).
  - Pie and bar chart refinements with responsive donut sizing (via Recharts).
  - 30-day sleep duration overview with reference lines.
- **Sleep Session Exploration**: Selection of sessions to open a deep-dive DetailsSheet.
- **Advanced Metrics**:
  - Computes `avgSleepMinutes` and `nightsCount` over a fixed 180-day query window.
  - Calculates `avgBedtimeMinutes` using bedtime minutes grouped across midnight to ensure proper average bedtime representation.

### 5.6 Screentime

**Purpose**: visibility into time spent on apps/web.

Requirements:
- Daily summary and app/domain breakdown.
- Import/parsing of screentime logs with automatic history backfill support.
- Displays device synchronization times and tracks `updated_at` properties on file uploads.

### 5.7 Calendar

**Purpose**: see scheduled events and time blocks.

Requirements:
- Display calendar events (local database and read-only iCal feed subscriptions).
- **Custom Recurrence Patterns**: Support for custom weekly recurrence on specific weekdays (e.g. repeating on Monday & Wednesday) conforming to standard iCal `BYDAY` rules.
- **Reminders & Alerts**:
  - Core notifications dispatch edge function with early reminder intervals (0 to 60+ minutes) and explicit toggle switches.
  - Tied to due times: clearing time disables reminders; setting time auto-enables them.
- **Bi-directional Sync**: Event title/description modifications automatically propagate changes to matching tasks.

### 5.8 Finance

**Purpose**: track transactions and budget guardrails.

Requirements:
- Transaction log supporting standard expenses, income, bank placements, and correction transactions.
- Budgets and monthly summaries.
- Mobile Layout: Tab wrapping optimizations to fit smaller screens.

### 5.9 Analytics

**Purpose**: review trends across domains.

Requirements:
- Rolling windows (7/30/90 days).
- Health and productivity metrics normalized for readability.
- Privacy mode toggling to hide sensitive financial/wealth data in public settings.

### 5.10 Weekly Planner

**Purpose**: weekly planning by day.

Requirements:
- Week view starting Sunday.
- Add lines to each day.
- When a “planner line” is added to a day, also create a Task due that day (so it appears in task views).

---

## 6) UX principles

- Use existing UI primitives and patterns (no parallel dialog systems).
- Prefer bottom sheets / details modals for “details/edit” flows.
- **Native-Like Feel**:
  - Global text selection is disabled (`user-select: none`) across base elements to avoid accidental selection during swipes/taps.
  - Text selection remains fully enabled in inputs, textareas, and contenteditable zones.
- **Responsiveness**: Smooth transitions and optimistic updates for actions.
- Accessibility: keyboard nav, focus styles, predictable interactions.

---

## 7) Data + security requirements

- All user data must be isolated by `user_id`.
- Supabase enforces isolation via Row Level Security (**RLS**).
- Edge Functions must not be publicly callable for destructive operations.
- **SSRF Mitigation**: Proxy API endpoints validate and parse target host headers to prevent Server-Side Request Forgery.
- Secrets:
  - Never put service role keys in client code.
  - Cron secrets must be passed via headers (not query parameters).

---

## 8) Infrastructure & deployment

- **Web Hosting**: Vercel (`https://life-os-tan.vercel.app/`)
- **Database & Auth**: Supabase database, auth, and edge functions (Deno)
- **PWA Service Worker**:
  - Implemented update throttling (30s) during visibility toggles to avoid spamming updates.
  - Initial service worker claim guards (`useRef` check) to prevent reloads on initial load.
  - Loop protection: tracking reload timestamps in `sessionStorage` (10s window) to block infinite refresh loops.
  - Service worker click listener directs all clicks to `/dashboard` passing query IDs.
- **Desktop Distribution**:
  - Automated Pake-cli compilation via GitHub Actions on push to `main`.
  - Targets Windows (`.exe`, `.msi`), macOS (`.dmg`), and Linux (`.deb`, `.AppImage`).
  - Uses native platforms icons (ICO for Windows, PNG for macOS/Linux).
  - Features system tray integration (`--show-system-tray`) to allow running in background.
  - Publishes rolling releases tagged as `latest`.
- **Continuous Integration (CI)**:
  - Runs formatting and typechecks (`pnpm typecheck`, `pnpm lint`).
  - Runs unit tests (`vitest`) for key business logic (App rendering, analytics, formatting utilities, prayerStatus, dashboard upcoming items).
  - Integrates SAST/secrets scans (Gitleaks, njsscan).
  - Integrates DAST (OWASP ZAP baseline scanner) starting the dev server dynamically.
  - Runs dependency audits (`pnpm audit`).

---

## 9) Success metrics

- Daily use without friction (open → understand → act in < 30 seconds)
- Reliable sync and data correctness across tasks and calendar events
- Trust: no cross-user leakage, no broken auth boundaries
