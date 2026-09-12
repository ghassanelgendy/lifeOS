# lifeOS — Software Requirements Specification (SRS)

**Version:** 1.0.0  
**Date:** Generated from Codebase Documentation  
**Scope:** Complete functional and non-functional requirements derived from the lifeOS source code.

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Overall Description](#2-overall-description)
3. [Functional Requirements](#3-functional-requirements)
   - 3.1 [Authentication & Authorization](#31-authentication--authorization)
   - 3.2 [Dashboard & Navigation](#32-dashboard--navigation)
   - 3.3 [Task Management](#33-task-management)
   - 3.4 [Habit Tracking](#34-habit-tracking)
   - 3.5 [Calendar & Events](#35-calendar--events)
   - 3.6 [Finance Management](#36-finance-management)
   - 3.7 [Sleep Tracking](#37-sleep-tracking)
   - 3.8 [Digital Wellbeing / Screen Time](#38-digital-wellbeing--screen-time)
   - 3.9 [Health & Body Metrics](#39-health--body-metrics)
   - 3.10 [Notes & Knowledge Management](#310-notes--knowledge-management)
   - 3.11 [Focus Sessions](#311-focus-sessions)
   - 3.12 [Prayer Times & Habits](#312-prayer-times--habits)
   - 3.13 [Analytics, Reports & Wraps](#313-analytics-reports--wraps)
   - 3.14 [Points & Gamification](#314-points--gamification)
   - 3.15 [Settings & Customization](#315-settings--customization)
   - 3.16 [Notifications](#316-notifications)
   - 3.17 [Offline Support & Data Sync](#317-offline-support--data-sync)
   - 3.18 [Deep Links & Integrations](#318-deep-links--integrations)
   - 3.19 [AI Assistant & Copilot](#319-ai-assistant--copilot)
4. [Non-Functional Requirements](#4-non-functional-requirements)
   - 4.1 [Performance](#41-performance)
   - 4.2 [Reliability & Availability](#42-reliability--availability)
   - 4.3 [Security](#43-security)
   - 4.4 [Scalability](#44-scalability)
   - 4.5 [Usability](#45-usability)
   - 4.6 [Maintainability](#46-maintainability)
   - 4.7 [Portability](#47-portability)
   - 4.8 [Accessibility](#48-accessibility)
5. [External Interface Requirements](#5-external-interface-requirements)
6. [Data Requirements](#6-data-requirements)

---

## 1. Introduction

### 1.1 Purpose
This SRS document captures the complete set of functional and non-functional requirements for **lifeOS**, a personal life operating system designed to unify task management, habit tracking, calendar scheduling, financial tracking, health monitoring, digital wellbeing, and analytics into a single cohesive application.

### 1.2 Scope
lifeOS is a cross-platform application (Web/PWA, iOS native via Capacitor, Desktop via Pake wrapper) with a Supabase backend, Vercel serverless API routes, and Deno-based Edge Functions. It supports offline-first operation with background synchronization, multi-platform push notifications, and deep-linking.

### 1.3 Definitions & Acronyms
| Term | Definition |
|------|-----------|
| PWA | Progressive Web App |
| OTA | Over-The-Air (update) |
| SW | Service Worker |
| iCal | Internet Calendaring and Scheduling |
| VAPID | Voluntary Application Server Identification |
| RLS | Row-Level Security (Supabase) |
| CSR | Client-Side Rendering |
| FOUC | Flash of Unstyled Content |

---

## 2. Overall Description

### 2.1 Product Perspective
lifeOS functions as a unified personal dashboard where a user's **intent** (plans) and **evidence** (what actually happened) coexist. It replaces fragmented tools (separate to-do apps, habit trackers, financial spreadsheets, calendars) with one integrated system.

### 2.2 Product Functions
- Unified task and goal management with intelligent views
- Advanced habit engine with standard, detox, and prayer habit types
- Calendar sync with iCal subscriptions and task-to-calendar links
- Financial hub with smart budgeting, bank SMS ingestion, and investment tracking
- Health & wellness tracking (sleep stages, InBody metrics)
- Digital wellbeing / screen time monitoring
- Rich notes and project management
- Cross-domain analytics and automated reports
- Prayer time calculation with smart notifications
- Gamification via points system

### 2.3 User Classes
- **Primary User:** Individual seeking to organize and optimize their personal life
- **Power User:** Heavy users leveraging all modules, custom lists, tags, automation
- **Mobile User:** iOS app user wanting native notifications and offline access
- **Desktop User:** Power user on desktop wrapping the web app

### 2.4 Operating Environment
- **Web:** Modern browsers (Chrome, Safari, Firefox, Edge) supporting ES2022+
- **iOS:** iOS 13+ (Safari 13+ target), native via Capacitor 8
- **Desktop:** Windows/macOS/Linux via Pake (Tauri-based wrapper)
- **Backend:** Supabase (PostgreSQL + Edge Functions on Deno), Vercel serverless

---

## 3. Functional Requirements

---

### 3.1 Authentication & Authorization

#### FR-AUTH-001: User Registration
The system shall allow users to create accounts using email/password or Google OAuth.

#### FR-AUTH-002: User Login
The system shall support password-based login and Google OAuth redirect login.

#### FR-AUTH-003: Session Management
The system shall persist sessions using Supabase auth with `autoRefreshToken`, `detectSessionInUrl`, and localStorage-backed session storage.

#### FR-AUTH-004: Protected Routes
The system shall enforce authentication on all application routes except `/login` and `/signup`. Unauthenticated users shall be redirected to `/login`.

#### FR-AUTH-005: Guest Protection
The system shall prevent authenticated users from accessing `/login` or `/signup` by redirecting them to `/dashboard`.

#### FR-AUTH-006: Account Switch Isolation
When the authenticated user changes (account switch or logout), the system shall clear all user data caches including React Query cache, localStorage, and IndexedDB to prevent data leakage between users.

#### FR-AUTH-007: Loading State
During authentication state initialization, the system shall display a loading screen with an indeterminate progress bar.

#### FR-AUTH-008: RLS Enforcement
All Supabase database queries shall be protected by Row-Level Security policies ensuring users can only access their own data.

---

### 3.2 Dashboard & Navigation

#### FR-DASH-001: Default Landing Page
The system shall redirect authenticated users to the Dashboard route (`/dashboard`) upon login.

#### FR-DASH-002: Dashboard Layout Modes
The system shall support three dashboard modes: **Quick View**, **Strategic**, and **Annual Review**, with the ability to cycle between them.

#### FR-DASH-003: Widget System
The Dashboard shall display customizable widgets including: Daily Hadith, Prayer, Stats, Overdue Tasks, Events, Quick Stats, and Habits.

#### FR-DASH-010: Daily Hadith Widget
The system shall display a Daily Hadith banner on the Dashboard featuring a curated collection of 365+ authentic concise Hadiths, ensuring a unique Hadith every single day of the year with zero repetitions across the cycle. The widget shall support Cairo typography styling, elevated light mode contrast matching iOS system appearance, deterministic and persistent date-based assignment (`getDailyHadith`), random in-session rotation avoiding recently seen hadiths (`getRandomHadith`), one-click copy to clipboard, category badges, and optional English translation.

#### FR-DASH-004: Widget Visibility Toggle
Users shall be able to toggle the visibility of individual dashboard widgets.

#### FR-DASH-005: Widget Reordering
Users shall be able to reorder dashboard widgets via up/down controls.

#### FR-DASH-006: Mobile Navigation Bar
The system shall display a bottom navigation bar on mobile with 5 customizable slots (default: Dashboard, Tasks, Focus, Habits, Calendar).

#### FR-DASH-007: Desktop Sidebar Navigation
The system shall display a collapsible sidebar on desktop with 11+ navigable sections. Users shall be able to reorder and toggle visibility of sidebar items.

#### FR-DASH-008: Navigation Customization Reset
Users shall be able to reset desktop navigation order and visibility to system defaults.

#### FR-DASH-009: Default Tab Setting
Users shall be able to set any route as their default landing tab upon app open.

#### FR-DASH-010: Command Palette
The system shall provide a command palette (keyboard-triggered) for rapid navigation and command execution.

#### FR-DASH-011: Strategic Horizon
In Strategic mode, users shall be able to view tasks/goals across configurable time horizons (30, 90, or 180 days).

#### FR-DASH-012: Annual Review
In Annual Review mode, users shall be able to view year-in-review data and write reflection notes per year.

#### FR-DASH-013: Upcoming Items Aggregation
The Quick View dashboard shall aggregate upcoming tasks, habits, calendar events, and prayer times into a unified timeline.

#### FR-DASH-014: Overdue Task Visibility
The Dashboard shall prominently display overdue tasks with count badges.

#### FR-DASH-015: Prayer Widget
The Dashboard shall display current/next prayer times with countdown and quick-status actions.

---

### 3.3 Task Management

#### FR-TASK-001: Task Creation
Users shall be able to create tasks with title, description (supporting subtask extraction via markdown checkboxes), due date, due time, priority, recurrence, tags, and list assignment.

#### FR-TASK-002: Smart Views
The system shall provide smart task views: Today, Week, Upcoming, All, Completed, and Won't Do.

#### FR-TASK-003: Task Lists
Users shall be able to create, rename, and delete custom task lists (projects/contexts).

#### FR-TASK-004: Tags
Users shall be able to create, rename, and delete tags for task categorization.

#### FR-TASK-005: Task Completion Toggle
Users shall be able to mark tasks as complete/incomplete with animated checkmark feedback.

#### FR-TASK-006: Task Editing
Users shall be able to edit all task fields via a detail sheet/modal interface.

#### FR-TASK-007: Task Deletion
Users shall be able to delete tasks with confirmation.

#### FR-TASK-008: Subtasks
Tasks shall support subtasks parsed from description markdown (`- [ ] subtask`).

#### FR-TASK-009: Recurring Tasks
Tasks shall support recurrence patterns (daily, weekly, etc.) with end conditions.

#### FR-TASK-010: Task Priority
Tasks shall support High/Medium/Low priority levels with shortcut keys (`!!`, `!`, `.` in input).

#### FR-TASK-011: Natural Language Parsing
Task input shall support natural language parsing for due dates (`tomorrow`, `next Monday`, `in 3 days`).

#### FR-TASK-012: Task-to-Habit Conversion
Users shall be able to convert a task into a habit.

#### FR-TASK-013: Calendar Task Feed
The system shall generate an iCal feed URL for tasks so users can subscribe in external calendar apps.

#### FR-TASK-014: Default Task View
Users shall be able to set a default task view (smart list or custom list) that loads when navigating to Tasks.

#### FR-TASK-015: Task Reminders
The system shall send push notification reminders for tasks based on their due time.

#### FR-TASK-016: Swipe Actions (Mobile)
On mobile, tasks in lists shall support swipe actions for quick complete/delete.

#### FR-TASK-017: Pull to Refresh (Mobile)
On mobile, task lists shall support pull-to-refresh gesture.

#### FR-TASK-018: Weekly Planner
The system shall provide a week planner view where users can assign tasks to specific days.

#### FR-TASK-019: Smart Unscheduled Task Scheduler
The system shall provide a 1-click smart scheduling mechanism that evaluates all unscheduled tasks and calculates conflict-free awake time slots across the upcoming week or month, avoiding sleep intervals (derived from sleep tracking metrics) and avoiding overlaps with existing scheduled tasks and calendar events with a 15-minute buffer.

#### FR-TASK-020: Platform Responsive Task Modal (DetailsSheet)
The system shall render task creation/editing detail sheets as a bottom slide sheet on mobile and iOS devices with gesture dismissal, and dynamically render as a centered, focused desktop dialog modal on PC web screens (`sm:` viewport breakpoint).

#### FR-TASK-021: Task Reorganization Modes (This Week & Selected Tasks)
The Smart Scheduler modal shall provide reorganization modes, alongside scheduling unscheduled tasks:
1. **Reorganize This Week:** Re-spreads tasks already scheduled within the current calendar week (Monday-Sunday) across a wider or narrower horizon (the current week vs. the current month).
2. **Reorganize Selected Tasks:** Re-spreads arbitrary user-selected tasks across the chosen horizon (week or month).
Both modes use the same conflict-free awake-slot engine and treat every task not in the target reorganization set (plus calendar events) as fixed obstacles. These modes shall not touch habit-derived task instances or "won't do" tasks.

#### FR-TASK-022: Dashboard-Matched Task Row Styling (PC Web)
On PC web, individual task rows on the Tasks page shall visually match the task entry styling used on the Dashboard: a persistently bordered, shadowed card with a tinted/dimmed completed state, and an enlarged circular completion toggle with a focus-visible ring, instead of a flat hover-only border with a small checkbox.

#### FR-TASK-023: Task Search
The Tasks page (PC web, iOS, and desktop/Pake) shall provide a search toggle in the header that expands into a text input filtering the currently active view (smart list, custom list, or tag) by task title, description, and tag name, case-insensitively. The filter shall apply within the active view rather than across all tasks globally, matching the scoping behavior of the existing Notes full-content search. Closing the search (X button or Escape key) shall clear the query and restore the unfiltered view.

#### FR-TASK-024: Scrolling Task Titles
Task row titles on the Tasks page (PC web, iOS, and desktop/Pake) shall use the same `MarqueeTitle` component as Dashboard entries: a title that overflows its row shall stay clipped to one line and scroll horizontally on hover (desktop) or touch-hold (mobile) to reveal the full text, rather than wrapping onto additional lines and growing the card.

#### FR-TASK-025: Date-Aware Smart Scheduling
The Smart Unscheduled Tasks Scheduler and Reorganize modes shall detect an explicit date named in a task's title — a weekday, a relative day ("tomorrow"), a written date ("15 June"), or a numeric `D/M` date interpreted as DAY/MONTH (e.g. "10/9" = 10 September) — and pin that task to the named date (finding a conflict-free time within that date) instead of assigning it to whichever slot the free-slot distribution algorithm finds next. The same numeric-date parsing shall also run at Quick Add time so a typed date like "10/9" is captured into `due_date` immediately, rather than the task remaining unscheduled and being assigned an unrelated date later.

#### FR-TASK-026: Multi-Select & Batch Processing (PC Web & iOS)
The system shall provide a multi-select mode on the Tasks page accessible via a "Select" button in the header. When enabled:
- Each task card displays a selection checkbox.
- A batch toolbar appears with item count and quick selection actions ("Select All", "Select Brain Dump" to isolate auto-generated tasks, and "Deselect").
- The system supports batch operations: Batch Mark Done, Batch Mark Won't Do, Batch Reorganize (1-tap smart reschedule of selected tasks across week or month), Batch Move to List (modal selection), Batch Add Tag (modal selection), and Batch Delete (with confirmed deletion dialog).
- Selecting tasks in selection mode shall not trigger the task editing sheet or modal.

#### FR-TASK-027: Task Creation Timestamp Display
The system shall display the creation timestamp (`created_at`) for every task:
- As an informative Clock badge on list cards (formatted as 12-hour time if created today, or month/day for previous days, with full timestamp on hover).
- As a dedicated "Added" creation date and time row within the Task Details bottom sheet and modal.

#### FR-TASK-028: Defensive Task Rendering & UUID Mutation Guards
The system shall safeguard task rendering and mutations against data inconsistencies:
- The task list views (PC web, iOS, Pake desktop) shall defensively guard all object properties, date parsing (`parseDueDateTime`, `formatDueDate`), and tag arrays (`Array.isArray(task.tag_ids)`), ensuring malformed or null values never cause runtime render exceptions.
- Mutation hooks (`useUpdateTask`, `useToggleTask`, `useDeleteTask`, `useBatchDeleteTasks`) shall validate task IDs against standard UUID regex before initiating Supabase Postgres operations, safely skipping non-UUID identifiers (such as habit pseudo-tasks or client-only tasks) to prevent PostgreSQL type 22P02 errors.
- The global `ErrorBoundary` shall capture and display the runtime error message along with single-click clipboard copying and direct Dashboard navigation to allow recovery without getting stuck in a crash loop.

---

### 3.4 Habit Tracking

#### FR-HABIT-001: Habit Creation
Users shall be able to create habits with name, description, frequency (daily, weekly, specific days), type (boolean, numeric, timer, prayer), and color.

#### FR-HABIT-002: Habit Types
The system shall support:
- **Standard habits:** Check off when done
- **Numeric habits:** Track a numerical value
- **Timer habits:** Track duration
- **Detox habits:** Progressive reduction with exponential/incremental targets
- **Prayer habits:** Track prayer status across 5 daily prayers

#### FR-HABIT-003: Habit Logging
Users shall be able to log habit completion for a specific date with value/duration where applicable.

#### FR-HABIT-004: Streak Tracking
The system shall calculate and display current streaks and best streaks per habit.

#### FR-HABIT-005: Streak Rescue
Users shall be able to "rescue" a broken streak by spending points, with rescue cost increasing exponentially.

#### FR-HABIT-006: Adherence Visualization
The system shall display adherence calendars (heatmaps) showing habit completion history.

#### FR-HABIT-007: Habit Insights
The system shall provide habit insights including average adherence, best/worst days of week, and trend analysis.

#### FR-HABIT-008: Habit Archiving
Users shall be able to archive habits without losing historical data.

#### FR-HABIT-009: Habit Unarchiving
Users shall be able to restore archived habits.

#### FR-HABIT-010: Weekly Adherence Tracking
The system shall calculate weekly adherence percentages per habit.

#### FR-HABIT-011: Detox Calculation
For detox habits, the system shall automatically compute target values based on start value, target value, mode (incremental/exponential), and weeks elapsed.

#### FR-HABIT-012: Habit Notifications
The system shall send reminders for habits scheduled on specific days/times.

#### FR-HABIT-013: Habit Stats & Adherence Modal
Clicking any habit in list, card, or matrix views shall open an interactive habit statistics modal (`HabitStatsModal.tsx`) presenting:
- Current streak and longest streak records.
- 7-day, 30-day, and 90-day adherence rate progress indicators.
- A 30-day activity matrix heatmap visualizing completed and missed days.
- Strongest day of the week analysis based on historical logs.
- Direct shortcut to edit the habit's configuration.

---

### 3.5 Calendar & Events

#### FR-CAL-001: Calendar View
The system shall provide calendar views (month, day) displaying events.

#### FR-CAL-002: Event Creation
Users shall be able to create calendar events with title, date, time, timezone, location, recurrence, and description.

#### FR-CAL-003: Event Types
Events shall support types: Event, Task, Prayer, or custom.

#### FR-CAL-004: iCal Subscription
Users shall be able to subscribe to external iCal feeds which are parsed, cached, and displayed alongside native events.

#### FR-CAL-005: Calendar Export
Users shall be able to export calendar events to `.ics` files.

#### FR-CAL-006: Calendar Event Feed
The system shall generate an iCal feed for calendar events accessible via tokenized URL.

#### FR-CAL-007: Show Tasks on Calendar
Users shall be able to toggle the display of task deadlines on the calendar.

#### FR-CAL-008: Event Notifications
The system shall send push notifications before scheduled events.

#### FR-CAL-009: Expanded Events
Recurring events and iCal events shall be expanded into individual instances for calendar display.

#### FR-CAL-010: Weekly Planner Grid Layout
The system shall provide a Weekly Planner route configured as a 2x4 grid layout (Sunday-Saturday + a Self Care card) mirroring a Saturday paper planning workflow.

#### FR-CAL-011: Unified Daily Cards
Each day's card in the grid shall contain tasks due on that day (including both normal and high priority tasks, styled and colored according to priority), calendar events (Meetings), standard habits scheduled for that day (excluding detox habits), and faint-blue lined notepad inputs in one consolidated scrollable card.

#### FR-CAL-012: Relative Crowdness Color Coding
The planner shall color-code each day's header dynamically based on relative crowdness (total items: tasks + events + scheduled habits for that day) compared to the min/max density of that week, interpolating from green (empty) to red (crowded).

#### FR-CAL-013: Prefilled Modals Redirection
Creating a task or event from a day card in the Weekly Planner shall redirect the user to the Tasks or Calendar routes with the date parameter pre-filled, launching the standard creation sheets automatically.

#### FR-CAL-014: Weekly Load Heuristics
The planner shall display a comparison sparkline comparing the current week's item density (tasks + events + scheduled habits) against the past 3 weeks, dynamically calculating and displaying a load rating (e.g. Heavy Load, Optimal Load, Light Load) based on historical averages.

#### FR-CAL-015: Day Card Drag and Drop Re-scheduling
The system shall support HTML5 native drag-and-drop of tasks and calendar events across day cards in the Weekly Planner:
- Tasks can be dragged from any day card onto another day card to instantly update their `due_date`.
- Calendar events can be dragged across day cards, updating their `start_time` and `end_time` dates while preserving original hours, minutes, and durations.
- Day cards highlight visually as active drop targets (`ring-2 ring-blue-500`) when an item is dragged over them.

#### FR-CAL-016: Smart Weekly Coach & Next-Week Dynamic Scheduler
The system shall provide a smart next-week scheduling engine integrated into the Weekly Planner:
- Smartly harvests unfinished tasks that were not completed during the evaluated week, as well as overdue tasks (`is_completed = false`, `is_wont_do = false`, `due_date <= weekEndDate`), regardless of whether the task was created manually or by AI/braindump/smart organizer.
- Parses actionable task suggestions (`ai_analysis.tasks`) from that week's brain dump notes (`is_brain_dump = true`), deduplicating against tasks already completed or created.
- Derives user awake windows from Apple Health sleep stage logs (or default 08:00–23:00) and calculates verified free awake slots by subtracting calendar events and time-bound tasks for next week.
- Distributes harvested candidates into free awake time slots across next week's days, sorted by priority (urgent/high first).
- Provides an interactive review modal allowing users to inspect suggested day and time slots, change days, exclude candidates, and batch-apply with a single click.

---

### 3.6 Finance Management

#### FR-FIN-001: Transaction Recording
Users shall be able to record income and expense transactions with amount, category, description, date, time, and direction (In/Out).

#### FR-FIN-002: Transaction Categories
The system shall provide predefined categories (Food, Transport, Shopping, Bills, etc.) and allow custom categories.

#### FR-FIN-003: Cash Flow Summary
The system shall display cash flow summaries with total income, total expenses, and net balance.

#### FR-FIN-004: Category Breakdown
The system shall display spending breakdown by category with percentage distribution.

#### FR-FIN-005: Transaction History
Users shall be able to view, filter, and search transaction history.

#### FR-FIN-006: Transaction Editing
Users shall be able to edit and delete transactions.

#### FR-FIN-007: Bank Management
Users shall be able to add and manage bank accounts, with auto-seeded default banks.

#### FR-FIN-008: Financial Summary Real-time Updates
The system shall listen for database changes and refetch financial data in real-time.

#### FR-FIN-009: Investment Tracking
Users shall be able to track investment accounts and investment transactions separate from daily spending.

#### FR-FIN-010: Investment CRUD
Users shall be able to create, update, and delete investment accounts and transactions.

#### FR-FIN-011: Bank SMS Parsing & Full-Field AI Audit (Automated)
The system shall accept forwarded bank SMS messages via the `process-sms` Supabase Edge Function, immediately inserting the transaction and returning an instant response (<100ms) to the client, while executing an asynchronous background AI audit cascade (Bynara and Dahl models, each retried once on transient failure) that cleans raw merchant/POS strings into human-readable entity names, resolves card/account identifiers, verifies direction and amounts, and proposes missing categories to a pinned `LifeOS Self Awareness` note. If every AI candidate fails, that failure is also recorded to the note rather than left silent.

#### FR-FIN-012: Smart Category Inference
The system shall attempt to infer transaction categories from description/merchant using predefined rules, learned rules from past manual corrections, and the background AI cascade. AI categorization reasons generally about the merchant's business type and the meaning of Arabic/Franco-Arabic dialect terms (e.g. "mwaslat" meaning transportation) rather than matching only a fixed keyword list, so it generalizes to merchants and phrasings not explicitly enumerated.

#### FR-FIN-013: Bank Statement Parsing & Smart Reconciliation
The system shall support parsing encrypted monthly PDF bank statements (Debit & Credit), extracting structured transaction records (entry/value dates, bank references, clean merchant and Instapay recipient entities, amounts, post-transaction balances), and smartly reconciling them against existing database transactions using exact amount, cash flow direction, and a smart date window. Matched records are enriched in-place with verified bank references, clean entities, and statement-verified status without inserting redundant duplicates.

#### FR-FIN-014: Privacy Mode
The system shall support a "privacy mode" that blurs financial data until hovered, for public screen viewing.

#### FR-FIN-015: Transaction Rules & Learning from Corrections
Users shall be able to configure automatic categorization rules based on transaction descriptions. Manually recategorizing a transaction in the Finance UI shall automatically create or update a `transaction_rules` entry for that merchant/description (via `useUpdateTransaction` in `src/hooks/useFinance.ts`), so future SMS and quick-expense transactions from the same merchant are categorized deterministically without an AI call.

#### FR-FIN-016: Deep Link Transaction Entry
Users shall be able to add transactions via deep links (`lifeos://add-transaction?amount=...&category=...`).

#### FR-FIN-017: Quick Cash Expense Logging & AI Categorization
The system shall provide a `quick-expense` webhook edge function optimized for iOS Shortcuts and Back Tap interactions, returning an immediate response (<100ms) upon cash transaction insertion. It first checks learned `transaction_rules` for an instant deterministic category match, then asynchronously categorizes expenses via a multi-model fallback cascade across Bynara and Dahl (each candidate retried once) with a general-reasoning system prompt, and records a note if every candidate fails.

#### FR-FIN-018: Desktop-Optimized Finance Page Layout
On PC web, the Finance page body shall be width-capped and centered (`max-w-7xl`) rather than stretching edge-to-edge, and the Banks tab and Investments tab's transaction list shall render as responsive multi-column grids at `md`/`lg`/`xl` breakpoints rather than remaining a single stacked column regardless of viewport width.

#### FR-FIN-019: Single Category Breakdown Display
The spending-by-category breakdown shall be rendered exactly once, as the standalone "By Category" list card. It shall not also appear as a selectable tab inside the grouped chart card, which shall default to its "Over time" view.

#### FR-FIN-020: Keyboard-Avoiding Transaction Sheets (iOS)
`DetailsSheet` (used by the transaction add/edit sheet, its embedded SMS/receipt-text parser, and other bottom sheets) shall reposition itself upward using the on-screen keyboard height on iOS, so its content and action buttons remain visible above the keyboard rather than being obscured by it.

#### FR-FIN-021: Dynamic Investment Platforms
Investment platforms (accounts) shall be fully user-managed: users shall be able to add, rename, or remove platforms from a "Platforms" panel on the Investments tab (PC web, iOS, and desktop/Pake). Thndr and Fawry shall be seeded once as starting suggestions only, not a fixed set. Removing a platform shall also delete its transactions (`investment_transactions.account_id` cascades), with the transaction count shown in the confirmation before removal. Renaming a platform shall require no relinking, since transactions reference it by `account_id`.

#### FR-FIN-022: Investment Transaction Types
Each investment transaction shall be tagged with a type — Deposit, Withdrawal, Profit, or Loss — shown as a badge in the transaction list, replacing the previous plain Income/Expense toggle, so gains/losses on a position are distinguishable from cash moved into or out of the platform.

#### FR-FIN-023: Investment Correction Transactions
Users shall be able to reconcile a platform's recorded balance to its real balance via a "Correction" action on the Investments tab: entering the real balance computes the adjustment needed and inserts an investment transaction tagged `Correction`, mirroring the existing bank Correction Transaction flow (FR-FIN, Transactions tab).

---

### 3.7 Sleep Tracking

#### FR-SLEEP-001: Sleep Session Logging
Users shall be able to log sleep sessions with start/end times and sleep stages.

#### FR-SLEEP-002: Sleep Stage Tracking
The system shall support sleep stage types: Deep, Light, REM, Core, and Awake.

#### FR-SLEEP-003: Sleep Metrics Dashboard
The system shall display sleep duration, sleep score, stage breakdown, and trends.

#### FR-SLEEP-004: Sleep Data Import (Chronos)
Users shall be able to upload sleep data from external sources (Chronos format) via Supabase Edge Function.

#### FR-SLEEP-005: Sleep Timeline Visualization
The system shall render sleep stage timelines showing transitions through the night.

#### FR-SLEEP-006: Weekly Sleep Summary
The system shall provide weekly sleep summaries with averages and trends.

#### FR-SLEEP-007: Sleep Goal Setting
Users shall be able to set nightly sleep duration targets (default: 8 hours).

---

### 3.8 Digital Wellbeing / Screen Time

#### FR-SCR-001: Screen Time Data Upload
Users shall be able to upload screen time data from external tracking tools via Edge Function.

#### FR-SCR-002: App Usage Tracking
The system shall track and display app usage duration, session count, and switches per app.

#### FR-SCR-003: Website Visit Tracking
The system shall track and display website visit duration and session count per domain.

#### FR-SCR-004: Daily Summary
The system shall provide daily screen time summaries with total usage, top apps, and top websites.

#### FR-SCR-005: Screen Time Goals
Users shall be able to set daily screen time limits (default: 8 hours).

#### FR-SCR-006: App Categorization
Apps shall be automatically categorized (Social, Entertainment, Productivity, etc.).

#### FR-SCR-007: Browser Detection
Browser apps shall be distinguished from standalone apps for analytics.

#### FR-SCR-008: Platform Support
Screen time data ingestion shall support both standard and Chronos platform formats.

---

### 3.14 Shared Collaboration

#### FR-COLLAB-001: Shared Todo Lists Collaboration
The system shall allow users to share an entire Task List with other users by email. Collaborators shall be able to view, create, edit, and mark tasks complete within shared lists in real-time.

#### FR-COLLAB-002: Shared Notes Collaboration
The system shall allow users to share Wiki Notes with other users by email. Collaborators shall be able to view and edit shared notes.


---

### 3.9 Health & Body Metrics

#### FR-HEALTH-001: InBody Scan Recording
Users shall be able to log InBody scan data including weight, BMI, skeletal muscle mass, body fat percentage, visceral fat level, and BMR.

#### FR-HEALTH-002: InBody History
The system shall display historical InBody scan trends with charts.

#### FR-HEALTH-003: Health Metrics Dashboard
The system shall provide a health dashboard displaying latest metrics and trends.

#### FR-HEALTH-004: InBody Data Sync
The system shall support InBody data synchronization via Supabase Edge Function with external APIs.

#### FR-HEALTH-005: Metric Comparison
The system shall show metric deltas (improvements/declines) between consecutive scans.

---

### 3.10 Notes & Knowledge Management

#### FR-NOTE-001: Note Creation
Users shall be able to create rich-text notes with titles and body content.

#### FR-NOTE-002: Folder Organization
Users shall be able to organize notes into folders.

#### FR-NOTE-003: Note CRUD
Users shall be able to create, read, update, and delete notes.

#### FR-NOTE-004: Folder CRUD
Users shall be able to create and rename note folders.

#### FR-NOTE-004a: Multi-Select & Bulk Delete (PC Web)
The notes list on PC web shall support a "Select" mode with per-note checkboxes, a "Select all" action scoped to the currently active folder/filter view, and a confirmed bulk-delete action.

#### FR-NOTE-005: Note Date Display
Notes shall display creation and update dates.

#### FR-NOTE-006: Platform-Optimized Responsive Views
The system shall deliver tailored user experiences per target platform:
- **PC Desktop (`Notes.web.tsx`)**: 3-column layout (folder sidebar, search/notes list, markdown live editor) with fixed viewport height and independent column scrolling, `/` search shortcut, word/character counter, pin toggles.
- **iOS Native (`Notes.ios.tsx`)**: Apple Notes aesthetic, grouped inset card lists, iOS header navigation, touch gestures, haptics (`triggerHaptics`), and 3D long-press context menus.

#### FR-NOTE-007: Cognitive Brain Dump AI Processor
The system shall provide a Cognitive Brain Dump processor (`BrainDumpModal.tsx`) with:
- Stream-of-consciousness raw thought capture & speech-to-text dictation.
- Automated AI classification detecting **Tasks**, **Habits**, and **Calendar Events** with 1-click creation buttons (+ Add Task, + Add Habit, + Add Event).
- Mental clarity score (1-100), mood/sentiment tags, executive summary, and key insights.

#### FR-NOTE-007a: Raw Thought Preserved as Task Detail
Any task created from a Brain Dump — via the manual per-task "Add Task" action, the AI Organizer's "Add Task" button, the batch "Sync Tasks" export, or the "Organize & File" / nightly auto-organizer flow — shall have its `description` field populated with the raw brain dump text it was extracted from (the source note's raw entries since its last organize pass, or the exact text last sent to the AI organizer when no note is attached), so the original context remains attached to the task.

#### FR-NOTE-007b: Auto-Organizer Creates Real Tasks, Not Just Checkboxes
The "Organize & File" action and the nightly `braindump-organizer` cron shall create real `tasks` rows for each AI-extracted action item (deduplicated by title against tasks already linked to that note via `source_note_id`), in addition to listing them as `- [ ] title` checkboxes in the organized note body. Re-running organize on an already-organized note shall extract only the genuine raw entries appended since the last pass (the text after the note's `### 🕒 Raw Thoughts Log` marker), not the AI's own prior summary/checkboxes, so repeated re-organizes cannot compound the note body into something the AI reads as "nothing new to extract."

#### FR-NOTE-007c: Auto-Organizer Extracts Dates From Task Text
For each AI-extracted action item, the `braindump-organizer` extraction prompt shall also request a `due_date` computed from any day or date named in the item's text (a weekday, "tomorrow", a written date, or a numeric `D/M` date interpreted as DAY/MONTH — e.g. "10/9" means 10 September, not October 9th), relative to the run's date boundary. If the model omits `due_date`, a deterministic numeric-date regex on the task title shall be tried as a fallback. Only when neither yields a date shall the created task default to today's date — it shall not be hardcoded to today regardless of what the text says.

#### FR-NOTE-007d: Automatic `#braindump` Tagging & Cross-Status Deduplication
All tasks extracted or synced from Brain Dumps shall be automatically associated with the user's `#braindump` tag (`color: #8b5cf6`). To prevent task duplication when notes are re-organized or updated:
- The system shall query all existing tasks for the user across ALL statuses (`is_completed = true`, `is_completed = false`, `is_wont_do = true`).
- A task shall be treated as a duplicate and skipped if its normalized title matches an existing task, or if string similarity exceeds 60%, or if its raw thought SHA-256 hash has already been processed.
- Marking a braindump task as completed or won't-do shall not cause it to reappear or be re-created upon subsequent brain dump organizes.

#### FR-NOTE-007e: Brain Dump Modal Text Selection
The Brain Dump modal interface shall allow standard mouse and touch text selection (`user-select: text`) on all prompt responses, captured notes, and thought logs, ensuring users can copy and highlight contents.

#### FR-NOTE-007f: Batch Task Selection & Deletion with Offline-Cache Sync
The Tasks management interface and `useBatchDeleteTasks` hook shall provide unified batch deletion:
- When deleting multiple tasks, child subtasks (`parent_id`) shall be cascaded and deleted before parent rows to fulfill PostgreSQL foreign key constraints.
- Deletions shall simultaneously purge from the React Query memory cache, Supabase remote storage, and local IndexedDB offline storage (`idbSaveTasks`) to prevent deleted tasks from resurrecting upon browser reload.
- The "Select Brain Dump" batch selector shall detect when the user is inside the `#braindump` tag view and select all visible tasks (active, completed, won't do), and shall match tasks across the full list via `tag_ids`, `description`, or `source_note_id`.

#### FR-NOTE-008: Note Pinning & Metadata
The database schema (`public.notes`) shall support `is_pinned`, `is_brain_dump`, `ai_analysis` (jsonb), and `tags` (text[]) for organizing thoughts.

#### FR-NOTE-009: iOS Back Tap & Deep Link Integration
The system shall register a URL scheme listener (`lifeos://braindump?text=`) in `App.ios.tsx` to handle iPhone Back Tap gestures via Apple Shortcuts, pre-filling text and triggering auto-classification upon app launch.

#### FR-NOTE-010: Server-Side AI Brain Dump Organizer
The system shall provide a server-side cron service (`braindump-organizer` Supabase Edge Function & `public.process_midnight_braindumps()` pg_cron job) executing nightly to summarize unorganized past brain dumps with configured AI providers and write structured notes to the `Organized Brain Dumps` folder. This automation shall be **opt-in and default OFF** per user (`brainDumpAutoOrganizeEnabled` in Settings > AI Assistant > Automations); the Edge Function shall only process notes belonging to users who have explicitly enabled it, shall resolve each note's AI provider keys strictly from that note's own owner (never falling back to another user's settings or API keys), and shall scope all related reads/writes (task lists, tags, organized-notes folder, duplicate cleanup) to that same user.

#### FR-NOTE-011: Browser Extension Companion & Chronos Screentime Tracker
The system shall provide a Manifest V3 browser extension companion (`extension/`) supporting:
- **Chronos Screentime Tracker:** Tracking active website domains and URLs in the background and batch syncing stats to `screentime_daily_website_stats`.
- **Real-time Screentime:** Aggregated active screentime for today displayed prominently at top.
- **Smart Web Clipper:** Extracting title, URL, user selection, and article content with auto-detection of default destination note (`"Projects I wanna try"`).
- **Today's Action Hub:** Quick task adder with priority/due time, today's pending tasks, and 1-tap habit completion toggles.
- **1-Click Sync:** Auto-detecting and importing auth credentials and Supabase configuration from open lifeOS tabs.

#### FR-NOTE-012: In-App AI Note Organizer & Smart Action Extractor
The system shall provide an in-app AI Note Organizer Sheet (`AINoteOrganizerSheet.tsx` in `Notes.web.tsx`):
- **Custom Prompt Instructions:** Enabling custom user prompts and instruction modifiers.
- **Append vs Replace Toggle:** Allowing users to choose whether to append organized results or replace note content.
- **Cognitive Action Items Extractor:** Parsing raw timestamps and bullets into discrete actionable tasks (e.g. calls, meetings, coding branches, emails, events).
- **Context-Aware Scheduling:** Suggesting realistic due dates (e.g. mapping explicit dates like "Oct 2"), times distributed across awake slots based on sleep tracking metrics, and mapping to existing user task lists and tags.
- **Interactive Review & Batch Creation:** Displaying an interactive task confirmation table where users can edit titles, dates, times, lists, and tags before committing them to the database.

---

### 3.11 Focus Sessions

#### FR-FOCUS-001: Focus Timer
Users shall be able to start focus sessions with a configurable timer.

#### FR-FOCUS-002: Task Selection
Users shall be able to select a specific task to focus on during a session.

#### FR-FOCUS-003: Focus Phase Tracking
Focus sessions shall track phases (Preparation, Focus, Break).

#### FR-FOCUS-004: Focus History
The system shall record completed focus sessions with duration and associated task.

#### FR-FOCUS-005: Picture-in-Picture (Desktop)
On desktop, the system shall support a floating PiP window for focus timer visibility while using other apps.

#### FR-FOCUS-006: Session Persistence
Focus session state shall persist across page refreshes.

---

### 3.12 Prayer Times & Habits

#### FR-PRAYER-001: Prayer Time Calculation
The system shall calculate Islamic prayer times (Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha) using the Adhan library based on user-configured latitude/longitude.

#### FR-PRAYER-002: Location Modes
Users shall be able to select location mode: GPS/device location or city search with manual coordinates.

#### FR-PRAYER-003: Prayer Tracking
Users shall be able to log prayer status for each of the 5 daily prayers with statuses: On Time, Late, Missed, Excused.

#### FR-PRAYER-004: Prayer Notification Settings
Users shall be able to configure push notification preferences per prayer with pre-alarm offsets and sound selection.

#### FR-PRAYER-005: Prayer Status Penalty System
The system shall calculate adherence penalties for late/missed prayers:
- Missed/Overdue prayers deduct 50 points.
- Late prayers deduct 25 points (yielding a 50% refund, i.e. +25 points, if changing from Missed to Late).
- Prayed/Done prayers deduct 0 points (yielding a 100% refund, i.e. +50 points, if changing from Missed to Prayed).

#### FR-PRAYER-006: Prayer Backlog
The system shall display a prayer backlog for missed prayers with make-up tracking.

#### FR-PRAYER-007: Prayer Widget
Dashboard shall display upcoming prayer with countdown and quick-action buttons.

#### FR-PRAYER-008: Prayer Notifications (Edge Function)
Supabase Edge Functions shall dispatch prayer notifications to all subscribed devices at calculated prayer times.

#### FR-PRAYER-009: Quiet Hours
Prayer notifications shall respect quiet hours configuration (e.g., no notifications during sleep).

---

### 3.12.1 Quran Memorizer & Smart Sheikh Halqah Notes

#### FR-QURAN-001: Dual Wird Management
The system shall display and track active Memorization Wird (ورد الحفظ) and Reading Wird (ورد التلاوة) with progress logs and streak counters.

#### FR-QURAN-002: Smart Automated Wird Detection for Halaqa Notes
When launching the Sheikh Halqah Note creation interface, the system shall automatically detect today's active wird page, identify the corresponding Surah, and compute smart start and end Ayah ranges.

#### FR-QURAN-003: 1-Click Wird Preset Pills
The Halqah Note modal shall present quick preset pills to switch between today's Memorization Wird and Reading Wird in a single click.

#### FR-QURAN-004: Direct Card & Reader Action Buttons
The system shall render direct "📝 تدوين ملاحظة" action buttons on Memorization/Reading cards and in the Quran Reader toolbar to launch smart note recording.

#### FR-QURAN-005: iOS-Native Mushaf Page View & Maximized Text Area
The page view shall display Quran pages with minimal border padding and native liquid glass controls, maximizing the visible Arabic calligraphy area while preserving authentic Surah headers and verse markers.

#### FR-QURAN-006: Compact iOS Toolbar, Dynamic Surah Fehres & Isolated Gesture Navigation
The reader shall provide an iOS-native liquid glass header with compact Surah and Juz dropdowns, dynamic Fehres (Index) pill button reflecting the active Surah on the current Medina Mushaf page across all view modes, and an iOS bottom sheet for secondary controls. Left-to-right swipe gestures on the Quran reader shall be strictly isolated to page turning, suppressing global sidebar drawer triggers. Navigating or deep-linking to an Ayah shall auto-scroll and highlight the verse within the view.

#### FR-QURAN-007: Ayah-Enriched Relative Wird Notifications & Deep Link Routing
The system shall automatically compute dynamic relative Wird information—including Medina Mushaf page number, exact Surah name, and latest Ayah number—inside both desktop/Pake local notifications and remote Web Push notifications scheduled for Quran Memorization Habits, Quran Reading Habits, and Sheikh Halqah Calendar Events. For habits tied to specific Surahs (such as Surat Al-Mulk and Surat Al-Kahf), notifications and UI habit cards shall provide direct clickable references (e.g. `📖 سورة الملك (ص 562)`, `📖 سورة الكهف (ص 293)`) deep-linking directly to `/quran?surah=..&page=..&ayah=1&tab=reader`. Tapping or clicking the notification shall route the user directly to the target Medina Mushaf page and verse.

#### FR-QURAN-008: Immersive Fullscreen Mushaf Reader with Audio Pill HUD, Multi-Surah Support & Pinch-to-Zoom
The system shall provide dedicated full-page fetching (`fetchPageVerses`) guaranteeing complete Medina Mushaf pages without cutting multi-page or shared-page surahs. In Fullscreen mode, the system shall provide two-finger touch pinch-to-zoom scaling (`0.65x` to `2.0x`), desktop sticky controls, and a mobile safe-area floating bottom HUD styled identically to the Audio Player floating pill (`backdrop-blur-2xl` glass geometry) with full audio controls (Play/Pause, Next/Prev Ayah, Audio Controls & Repeats drawer trigger), page navigation, and font zoom tools, avoiding top notch / Dynamic Island interference.

#### FR-QURAN-009: 12-Hour Non-Repeating Quran Hadith Modal & Adaptive Surah Headers
The system shall automatically present an inspiring Hadith dialog exclusively on mobile devices at 12-hour intervals. The Hadith shall be selected from an authentic Quran-virtues collection using a non-repeating queue, rendered with enhanced Arabic typography in adaptive light and dark modes (avoiding washed out colors or low contrast), and display the source/narrator in Cairo font (`font-cairo`). This modal is disabled on desktop/PC to prevent duplication with the Dashboard Hadith widget. Furthermore, Surah title headers in reader and fullscreen modes shall render with theme-adaptive amber gradients (`from-amber-100/80` in light mode, `from-amber-950/20` in dark mode) ensuring optimal contrast across system appearance changes.

#### FR-QURAN-010: Per-Ayah Mastery Toggling & Elevated Fullscreen Controls
The system shall support marking and toggling individual ayahs as memorized (`motqan`) with isolated verse-level precision rather than blanket-marking entire chapter sections. Player settings, surah picker, and tools drawers shall be elevated to layer `z-[10000+]` above fullscreen viewports with native iOS keyboard avoidance.

#### FR-QURAN-011: Dynamic Day-by-Day Weekly Planner Wird & Spaced Repetition (مراجعة) Badges
The system shall dynamically calculate and display day-specific projected Wird pages and weekly partitioned Spaced Repetition review portions across the 7 days of the Weekly Planner habit grid for Quran habits (`ورد أساسي: ص XX سورة YY • مراجعة: ZZ`), with single-click deep navigation directly to each day's target Medina Mushaf page.

#### FR-QURAN-012: Reversed Khatmah Sequential Traversal (الناس إلى البقرة)
In reverse khatmah plans (Surahs 114 to 1), page progression within any surah shall advance forward sequentially from its first page to its last page. Once the current surah's final page is completed, the cursor shall automatically transition to the first page (`pageStart`) of the next lower-numbered chapter.

#### FR-QURAN-013: 3D Ayah Action Context Menu, Bidirectional Habit Sync & Smooth Tafseer Sheet
Long-pressing any verse in the reader shall trigger an iOS 3D lift visual effect and open a frosted glass context menu providing 5 distinct actions: Hide Ayah (temporary session test), Set Memorization Checkpoint, Set Reading Checkpoint, Bookmark to Notes, and Explain (Tafsir Al-Muyassar sheet drawer). Setting a checkpoint shall immediately update `quran_khatmah_plans` and localStorage with the exact Ayah and page, update the linked habit's description with the latest Ayah position, and mark today's habit log completed. Conversely, completing a Quran habit advances the Wird and updates the checkpoint accordingly. The menu shall support drag/slide-to-select touch gestures. Selected ayahs shall use a non-intrusive underline without layout shift or wiggles, and Tafsir Al-Muyassar shall slide smoothly from the bottom.

#### FR-QURAN-014: Full Offline-First Quran Storage & In-Settings Full Downloader
All 604 Medina Mushaf pages with Arabic text and Tafsir Al-Muyassar shall be cached locally in IndexedDB (`quran_pages` store). Settings shall provide a dedicated one-tap downloader with real-time progress and verification for text and tafsir. Offline queueing shall handle plan mutations and note bookmarks when disconnected, and auth session state shall be bootstrapped synchronously from localStorage to guarantee instant offline app launches without network stalls.

#### FR-QURAN-015: Khatma Stats (Time-in-Mushaf & Completion Counters)
The system shall track cumulative time spent with the mushaf reader open and visible, and shall increment a reading-khatma counter whenever the reading wird advances past page 604, and a memorization-khatma counter whenever the memorization plan reaches its configured end boundary. These stats (`total_reading_seconds`, `reading_khatmas_completed`, `memorization_khatmas_completed` on `quran_khatmah_plans`) shall be shown as a stats card in the Khatmah tab, stored local-first, and synced cross-device by taking the max of local and remote values per field.

#### FR-QURAN-016: Reading Position Preservation on Habit Completion
Completing the daily reading-wird habit shall not overwrite a manually-set reading checkpoint that is already further along than the page the auto-advance would compute, except when that advance completes a khatma (wraps past page 604), in which case the marker shall always reset to the new starting page.

#### FR-QURAN-017: Fullscreen Mushaf Page-Turn Scroll Reset
Turning pages while the fullscreen Mushaf reader is active shall reset that view's own independently-scrolling container to its top (not just the window), and shall land the newly-loaded page's first ayah at the top of the viewport rather than centering it, so page transitions land cleanly at the top of the new page.

---

### 3.12.2 Azkar & Daily Supplications (الأذكار والأدعية النبوية)

#### FR-AZKAR-001: Auto-Offline Database
The system shall bundle 345 authenticated Azkar and supplications directly into the client assets and store favorite bookmarks (`azkar_favorites`) and daily progress logs (`azkar_daily_logs`) in IndexedDB (`lifeos-indexeddb`). All categories, searches, and recitation views shall function with 100% fidelity without internet connectivity.

#### FR-AZKAR-002: Contextual Sleep-Linked Recommendation
The system shall compute the recommended category based on current time and biometric sleep data:
- Prioritize **أذكار النوم (Sleep Azkar)** 90 minutes prior to user's usual bedtime (`avgBedtimeMinutes` from Sleep Module).
- Prioritize **أذكار الاستيقاظ (Waking Azkar)** during early morning hours (04:00 - 07:00).
- Prioritize **أذكار الصباح (Morning Azkar)** from Fajr until Dhuhr (05:00 - 12:30).
- Prioritize **أذكار المساء (Evening Azkar)** from Asr until sunset/sleep.
- Prioritize **الأذكار بعد السلام من الصلاة (Prayer Azkar)** midday and between prayers.

#### FR-AZKAR-003: Interactive Tactile Counting & Platform Gestures
The recitation view shall provide an interactive countdown card with large tap targets, a circular progress ring drawn around the tap counter, animated completion progress, haptic feedback on devices supporting vibration, completion chime sounds, and auto-advance capability. Tapping shall be recognized via the platform's dedicated tap gesture rather than a native click handler, since a native click is unreliable on the same element as an active drag/swipe gesture. On iOS, swipe gestures shall support RTL Arabic reading order (swipe left advances to next, swipe right returns to previous) with dual distance-and-velocity thresholds, drag lock to prevent vertical pull-to-refresh jitter, and touch drag guards ensuring swipe gestures never inadvertently increment the recitation counter. Progress writes shall be persisted to IndexedDB in a single read-modify-write transaction per tap (rather than separate read and write transactions) and shall update the in-memory query cache directly rather than triggering a network refetch, so rapid repeated tapping (tasbih runs of 33-100+) neither drops counts nor gets throttled by the API egress limiter.

#### FR-AZKAR-004: Digital Subhah / Tasbih Mode
The system shall provide an interactive digital Tasbih modal with a circular countdown ring, customizable repetition targets (33, 100, open/infinity), common preset supplications, and keyboard (Spacebar) support.

#### FR-AZKAR-005: Diacritic-Insensitive Search
The system shall provide instant client-side full-text search across all 345 Azkar normalizing Arabic diacritics (tashkeel), hamza variations, and taa-marbutah.

#### FR-AZKAR-006: Dashboard Widget Integration
The Dashboard shall display an Azkar widget showing the current recommended category, today's completion count, progress bar, and direct navigation to `/azkar`.

#### FR-AZKAR-007: Auto-Completed Habit Sync with Night Grace Window
Completing a Morning, Evening, or Sleep Azkar category shall auto-mark the matching user Habit (matched by title/description via `getAzkarHabitCategory`) as done for the day via a `habit_logs` row with `source: 'azkar_auto'`. For Evening and Sleep Azkar specifically, a completion occurring between midnight and 06:00 shall be credited to the previous calendar day rather than the new one, so reading night azkar late does not leave the new day's habit falsely pre-completed before the user has done anything on it. This grace window applies only to the auto-completed habit log's date; the raw Azkar reading/counting screen and its per-day progress log are unaffected and always follow the literal calendar day, so users can read Azkar as many times as they like without restriction.

---

### 3.12.3 Cognitive Brain Dump & Asynchronous Thought Vault

#### FR-DUMP-001: Instant Quick-Capture & Append
The system shall support instant thought saving in less than 100ms via `Cmd+Enter` or voice dictation, allowing thoughts to be appended directly to today's journal or saved as discrete atomic notes without blocking on AI analysis.

#### FR-DUMP-002: Thought Inbox & Review
The system shall provide a search-enabled Thought Inbox displaying all captured brain dump notes with timestamp metadata and status tags (`Pending / Unprocessed` vs `Organized`).

#### FR-DUMP-003: Deferred AI Batch Planning
The system shall allow users to select single or multiple captured thoughts during planning sessions to trigger batch AI structuring, extracting actionable tasks, recurring habits, and calendar events with 1-click database synchronization.

#### FR-DUMP-004: Unified Single Daily Journal Lifecycle
The system shall maintain strictly one unified Brain Dump Journal note per day (`Brain Dump Journal (YYYY-MM-DD)`). When organized via the Supabase midnight cron (`process_midnight_braindumps` + `braindump-organizer` Edge Function) or client-side batch organizer, the existing daily note shall be updated in-place (incorporating the AI summary, key takeaways, and action items above the raw thoughts log) without creating duplicate notes.

#### FR-DUMP-005: Smart Awake-Time Task Distribution & Bi-directional Note-Task Sync
The system shall intelligently analyze extracted brain dump action items and automatically:
1. Map them to matching user task lists (e.g. `Work`, `Learn`, `Personal`) and tags (e.g. `servixa`, `ischool`, `research`, `urgent`).
2. Distribute tasks across conflict-free awake hours across up to 35 days / next month (respecting user sleep/wake metrics, scheduled tasks with due times, and calendar events) with 1-click individual or batch addition.
3. Establish bi-directional sync via `source_note_id` so that checking off a task in To-Do list or Dashboard automatically toggles the corresponding checkbox (`- [ ]` <-> `- [x]`) in the organized Brain Dump note and vice-versa.

#### FR-DUMP-007: Remote Apple Shortcuts / Supabase Endpoint
The system shall expose the `append-braindump` Supabase Edge Function and `append_to_daily_braindump` stored procedure to append thoughts from iOS Apple Shortcuts, Siri dictation, or external webhooks directly into the active day's journal with timestamps.

---

### 3.13 Analytics, Reports & Wraps

#### FR-ANALYTICS-001: Daily Analytics
The system shall provide daily analytics aggregating tasks completed, habits adherence, sleep duration, screen time, and financial spending.

#### FR-ANALYTICS-002: Top Statistics
The system shall display top apps, top websites, top spending categories, and top merchants.

#### FR-ANALYTICS-003: Range Analytics
Users shall be able to view analytics across configurable date ranges.

#### FR-ANALYTICS-004: Weekly Reports
The system shall automatically generate weekly reports comparing current week to previous week across all tracked domains (sleep, screen time, tasks, habits, finance).

#### FR-ANALYTICS-005: Monthly Reports
The system shall automatically generate monthly reports with trend analysis, outlier detection, and best/worst day identification.

#### FR-ANALYTICS-006: Report Scoring
Reports shall include an overall week/month score computed from weighted domain metrics.

#### FR-ANALYTICS-007: Delta Badges
Reports shall display delta badges (improvement/decline arrows with percentages) for key metrics.

#### FR-ANALYTICS-008: Score Rings
Reports shall include animated SVG score rings for visual metric representation.

#### FR-ANALYTICS-009: Suggestions Engine
Reports shall include AI-generated suggestions based on identified patterns and outliers.

#### FR-ANALYTICS-010: Report Notifications
Users shall receive push notifications when weekly/monthly reports are ready.

#### FR-ANALYTICS-011: Wrapped Reports
The system shall generate periodic "Wrapped" reports (Weekly Wrap, Monthly Wrap) with summary statistics and shareable insights.

#### FR-ANALYTICS-012: Wrap Notification Tracking
The system shall track when wraps are viewed and notified to prevent duplicate notifications.

#### FR-ANALYTICS-013: Deep Insights
The system shall provide deep insights panel showing correlations between habits, tasks, sleep, and screen time.

#### FR-ANALYTICS-014: Habits Analytics
Dedicated analytics view for habit adherence trends, day-of-week patterns, and streak analysis.

#### FR-ANALYTICS-015: Digital Analytics
Dedicated analytics view for screen time trends, app usage patterns, and website visit analytics.

#### FR-ANALYTICS-016: Health-Wealth Analytics
Cross-domain analytics comparing health metrics (sleep) and financial patterns.

#### FR-ANALYTICS-017: Points Analytics
Analytics view showing points earned/consumed over time, reward redemption history, and balance trends.

#### FR-ANALYTICS-018: Day Details Modal
Users shall be able to click on any day in analytics charts to view detailed breakdown of that day's data.

#### FR-ANALYTICS-019: Animated Counters
Numeric displays in analytics shall animate (count up) on initial render for engagement.

#### FR-ANALYTICS-020: Report Targets
Users shall be able to set per-domain targets (sleep hours, screen hours, task count, habit percentage) for report comparisons.

#### FR-ANALYTICS-021: Autopilot Targets
The system shall support "autopilot" mode for targets that automatically adjust based on historical performance.

---

### 3.14 Points & Gamification

#### FR-POINTS-001: Points Earning
Users shall earn points for completing tasks on time, maintaining habits, achieving sleep goals, and staying under screen time limits.

#### FR-POINTS-002: Points Balance
The system shall maintain a real-time points balance per user.

#### FR-POINTS-003: Points Transaction History
All point additions and deductions shall be recorded with timestamps and reasons.

#### FR-POINTS-004: Daily Points Sync
A background worker shall calculate and award daily points based on the day's achievements.

#### FR-POINTS-005: Custom Rewards
Users shall be able to create custom rewards that can be redeemed with points.

#### FR-POINTS-006: Reward Redemption
Users shall be able to redeem points for custom rewards.

#### FR-POINTS-007: Rescue Tasks with Points
Users shall be able to spend points to "rescue" overdue tasks.

#### FR-POINTS-008: Streak Rescue Cost
Rescuing broken habit streaks shall cost points with exponential cost increase based on streak length.

#### FR-POINTS-009: Points Eligibility
The system shall determine date eligibility for points (e.g., no double-counting).

#### FR-POINTS-010: Task Completion Penalty Rules
The system shall calculate points based on a date-only logic for task completion. Tasks completed on or before their due date (regardless of the specific due time on that day) shall earn positive points and avoid late penalties. Reductions/penalties shall only apply if a task is marked completed after its due date has passed.

---

### 3.15 Settings & Customization

#### FR-SET-001: Theme Management & System/iOS Appearance Synchronization
The system shall support three theme modes: System Auto, Light, and Dark.
- In System Auto mode (default), the app shall dynamically match the host device (iOS / Android / Desktop) color scheme using `prefers-color-scheme` listeners and native app resumption hooks.
- The system shall automatically synchronize the native status bar (`@capacitor/status-bar`), virtual keyboard (`@capacitor/keyboard`), and HTML `theme-color` / `color-scheme` properties with the active appearance and iOS safe area header (`#1c1c1e` dark / `#f9f9f9` light), preventing title bar color mismatches.

#### FR-SET-002: Accent Color Selection
Users shall be able to select from 6 accent themes: Zinc (default), Blue, Green, Violet, Rose, Amber.

#### FR-SET-003: Custom Accent Themes (CSS)
Each accent theme shall fully tint the application background, cards, borders, primary colors, and rings.

#### FR-SET-004: Prayer Location Settings
Users shall be able to configure prayer location via device GPS or manual city search.

#### FR-SET-005: Prayer Notification Settings
Per-prayer notification preferences including offset times, sound selection, and vibration.

#### FR-SET-006: Mobile Nav Customization
Users shall be able to reorder the 5 mobile navigation slots.

#### FR-SET-007: Desktop Nav Customization
Users shall be able to reorder and toggle visibility of desktop sidebar navigation items.

#### FR-SET-008: Dashboard Widget Customization
Users shall be able to reorder and toggle visibility of dashboard widgets.

#### FR-SET-009: Page Widget Customization
Sleep and Habits pages shall support widget ordering and visibility customization.

#### FR-SET-010: Default Tab Configuration
Users shall be able to set any page as the default landing tab.

#### FR-SET-011: Default Task View
Users shall be able to set a default task view/list.

#### FR-SET-012: Privacy Mode Toggle
Users shall be able to enable privacy mode which blurs sensitive financial data.

#### FR-SET-013: Analytics Tips Toggle
Users shall be able to show/hide analytics tips.

#### FR-SET-014: Report Targets Configuration
Users shall be able to set and modify report targets for sleep, screen time, tasks, and habits.

#### FR-SET-015: Autopilot Toggle
Users shall be able to enable/disable autopilot target adjustment.

#### FR-SET-016: Wrap Notifications Toggle
Users shall be able to enable/disable weekly/monthly wrap notifications.

#### FR-SET-017: User App Settings Sync
User settings shall synchronize to the database so they persist across devices.

#### FR-SET-018: Platform UI Override (Desktop)
Desktop users shall be able to override whether the app renders in web or pake UI mode.

#### FR-SET-019: Sidebar Collapse
Desktop users shall be able to collapse/expand the sidebar.

#### FR-SET-020: Keyboard Shortcuts Modal
The system shall provide a modal displaying available keyboard shortcuts.

---

### 3.16 Notifications

#### FR-NOTIF-001: Push Notifications (Web)
The system shall support web push notifications via Service Worker and VAPID.

#### FR-NOTIF-002: Push Notifications (iOS)
The system shall support native iOS push notifications via Capacitor Push Notifications plugin.

#### FR-NOTIF-003: Local Notifications (iOS)
The system shall schedule and manage native iOS local notifications for tasks, habits, and events.

#### FR-NOTIF-004: Local Notifications (Desktop/Pake)
The system shall simulate local notifications on desktop using setInterval polling.

#### FR-NOTIF-005: Task Reminders
Users shall receive push notifications at task due times with "Mark Done" and "Postpone 1 Hour" action buttons.

#### FR-NOTIF-006: Habit Reminders
Users shall receive push notifications at configured habit reminder times.

#### FR-NOTIF-007: Prayer Notifications
Users shall receive push notifications at calculated prayer times with pre-alarm offsets.

#### FR-NOTIF-008: Calendar Event Notifications
Users shall receive push notifications before scheduled calendar events.

#### FR-NOTIF-009: Report Notifications
Users shall receive push notifications when weekly/monthly reports are ready.

#### FR-NOTIF-010: Notification Action Buttons
Push notifications shall include action buttons for quick interaction (Mark Done, Postpone, etc.).

#### FR-NOTIF-011: Notification Deep Links
Tapping notifications shall navigate to the relevant page with context (task ID, habit ID, prayer name).

#### FR-NOTIF-012: Badge Count (iOS)
The system shall update the iOS app badge count based on pending notifications.

#### FR-NOTIF-013: Quiet Hours
Notifications shall respect quiet hours configuration to avoid disturbance during sleep.

#### FR-NOTIF-014: Favicon Dynamic Update
The web app favicon shall dynamically update to show notification counts.

---

### 3.17 Offline Support & Data Sync

#### FR-OFFLINE-001: Offline Queue
When offline, create/update/delete operations shall be queued in IndexedDB.

#### FR-OFFLINE-002: Queue Replay
When connectivity is restored, the system shall automatically replay queued operations to Supabase.

#### FR-OFFLINE-003: React Query Cache
The system shall persist React Query cache to localStorage with 7-day max age.

#### FR-OFFLINE-004: Online/Offline Detection
The system shall detect network status and display an offline banner when disconnected.

#### FR-OFFLINE-005: Background Sync (PWA)
The Service Worker shall support `sync` events to trigger offline queue processing.

#### FR-OFFLINE-006: Sync Status Indicator
The system shall display sync status (last sync time, pending queue length).

#### FR-OFFLINE-007: Sync on Reconnect
The system shall process the offline queue when the browser/app detects network reconnection.

#### FR-OFFLINE-008: Conflict Handling
If an offline operation fails due to server-side conflicts, it shall remain in the queue for retry.

---

### 3.18 Deep Links & Integrations

#### FR-DL-001: Custom URL Scheme
The iOS app shall respond to `lifeos://` deep links.

#### FR-DL-002: Route Navigation via Deep Link
Deep links to `lifeos://dashboard`, `lifeos://tasks`, `lifeos://calendar`, `lifeos://finance` shall navigate to respective routes.

#### FR-DL-003: Transaction Deep Link
`lifeos://add-transaction?amount=X&category=Y&description=Z&type=W` shall queue a new transaction.

#### FR-DL-004: iOS 6 Lite Mode
The system shall provide a lightweight HTML page for iOS 6 compatibility with legacy auto-login support.

#### FR-DL-005: InBody Sync Integration
Supabase Edge Function shall sync InBody data from external APIs.

#### FR-DL-006: Screen Time Upload Integration
Supabase Edge Functions shall parse and ingest screen time data from external trackers.

#### FR-DL-007: Sleep Data Upload Integration
Supabase Edge Functions shall parse and ingest sleep data from Chronos and other formats.

#### FR-DL-008: Reminder Sync Integration
Supabase Edge Function shall sync iOS reminders/tasks via external API.

#### FR-DL-009: Calendar Feed Token
The system shall generate secure tokenized URLs for iCal calendar feeds.

#### FR-DL-010: Automated Task Creation Webhook Integration
Supabase Edge Function (`create-task`) shall accept automated POST requests from iOS Mail Automations, Apple Shortcuts, and external webhooks to create tasks with intelligent parsing of subject, body, due date/time, priorities, lists, subtasks, and tags.

---

### 3.19 AI Assistant & Copilot

#### FR-AI-001: Model API Call Execution & Native Transport
The system shall communicate with configured AI models via direct native HTTPS calls using `CapacitorHttp` on mobile/iOS with browser-standard User-Agent and headers (completely bypassing CORS and eliminating external proxy hops), or via the local/serverless `/api/ai` proxy on web browsers.

#### FR-AI-002: Dynamic Context Aggregation
The system shall compile user-scoped tasks, habits, recent notes, calendar events, financial transactions, and wellness statistics (sleep metrics, screentime, health scans) as Markdown text to feed into the AI system prompt.

#### FR-AI-003: Ingestion Toggles
The system shall allow users to select which data sources (Tasks, Calendar, Habits, Notes, Finance, Health) are sent to the AI router.

#### FR-AI-004: Quick Action Parsing
The system shall parse structured action tags in the AI response (e.g. `[ACTION:create_task|...]`, `[ACTION:create_event|...]`, `[ACTION:create_note|...]`, `[ACTION:create_transaction|...]`) and hide them from the chat bubble text.

#### FR-AI-005: Interactive Action Execution
The system shall render parsed action items as Action Cards with check/execution buttons linked to Supabase database mutations (e.g., creating tasks or calendar events).

#### FR-AI-006: Analysis Templates
The system shall provide quick templates ("Plan My Day", "Health Coach", "Expense Audit", "Notes Synthesizer") to start pre-configured chat queries.

#### FR-AI-007: Onboarding & Setup Redirects
If AI is disabled or keys are missing, the system shall block the chat view and display instructions redirecting to the settings screen.

#### FR-AI-008: Voice Dictation Ingestion
The system shall support recording and transcribing user voice dictation in Arabic/English dialect and passing it as the initial prompt to the AI Assistant.

#### FR-AI-009: Dashboard voice shortcut
The system shall provide a voice assistant option directly inside the floating quick action menu (FAB) on the Dashboard, rendering a premium recording indicator overlay and routing the transcript to `/chat` on completion.

#### FR-AI-010: AI Visibility Toggle Rules
When the AI Integration setting (`aiEnabled`) is disabled, the system shall dynamically hide all AI-related entrypoints, shortcuts, icons, and menus (including the Sidebar link, the Quick Add mic icon, the Dashboard FAB voice assistant, the row context voice dictate menu, and the Analytics AI coach card) to ensure all AI functionality disappears from the UI.

#### FR-AI-011: Analytics AI Hints
The system shall include an AI Coaching & Insights panel inside the Analytics Overview tab. This panel shall pass the range's computed metrics and mathematical Pearson correlation coefficients (across sleep, screen time, tasks, habits, and expenses) to the AI service on-demand to generate highly useful, mathematically grounded, and actionable suggestions.

#### FR-AI-012: Multi-Model Fallbacks & Cascading Queue
The system shall support cascading through prioritized candidate models across Dahl Inference API and Bynara API Router whenever a model encounters HTTP 429 (Rate Limit), HTTP 402, HTTP 404, HTTP 5xx, or network timeouts.

#### FR-AI-013: Model Health Tracking & Cooldown Penalty (Neglect)
The system shall maintain a persistent health ledger for all LLMs in localStorage. When a model fails with HTTP 429, it shall be placed in a timed cooldown state (5-30 minutes) and neglected in future request candidate queues until the cooldown expires.

#### FR-AI-014: Best Model Caching & Self-Healing
The system shall automatically record the fastest, most reliable model upon successful completion, storing it as the primary active model for subsequent requests. When cooldown timers expire, neglected models shall automatically self-heal and re-enter the eligible pool.

#### FR-AI-015: Chat & Thread Timestamps
The system shall display a human-readable timestamp on every chat message (`h:mm a`) and on every saved thread in the Chat History sidebar (time-only for threads updated today, `MMM d, h:mm a` for older threads), so users can tell when a conversation or message occurred.

#### FR-AI-016: Upstream Error Sanitization
When an AI provider or gateway returns a non-JSON error body (e.g. an HTML error/timeout page from an intermediary proxy), the system shall detect and discard the raw HTML rather than surfacing it as the failure message, since chat content is rendered through a markdown-to-HTML pipeline and raw HTML would otherwise inject foreign markup into the page and corrupt its styling.

#### FR-AI-015: Model Diagnostics & Health Inspector
The system shall provide a model benchmarking interface in Settings to run ping tests across all catalog models, displaying latency, success counts, failure counts, and live cooldown timers.

---

## 4. Non-Functional Requirements

### 4.1 Performance

#### NFR-PERF-001: First Contentful Paint
The application shall render the first contentful paint within 1.5 seconds on a 4G connection.

#### NFR-PERF-002: Route Transition
Route transitions shall complete within 300ms on average.

#### NFR-PERF-003: Animation Frame Rate
All UI animations shall run at 60fps (task-enter, modal-slide, checkmark-draw).

#### NFR-PERF-004: Query Staleness
React Query cached data shall be considered stale after 15 minutes, triggering background refetch.

#### NFR-PERF-005: Garbage Collection
React Query shall retain unused cache entries for 24 hours before garbage collection (supporting offline cache durability).

#### NFR-PERF-006: Bundle Size
The production JavaScript bundle shall be optimized with code splitting, tree-shaking, and lazy loading of route components.

#### NFR-PERF-007: Image Optimization
All uploaded/ingested images shall be automatically optimized; static assets shall support WebP/AVIF where possible.

#### NFR-PERF-008: Precaching Limits
Service Worker precaching shall exclude files larger than 3MB and glob patterns `favicon.svg`, `sw.ts`.

#### NFR-PERF-009: Optimistic Interactions
Toggle actions (completing tasks, logging habits, and backlog prayer status updates) shall apply state transitions client-side immediately (within 50ms), and execute Supabase mutations in the background. If mutations fail, client-side state shall rollback to its previous state.

### 4.2 Reliability & Availability

#### NFR-REL-001: PWA Offline Support
The application shall function as a standalone PWA with offline navigation and cached assets.

#### NFR-REL-002: Service Worker Update
The PWA shall check for service worker updates on load and app visibility changes, throttled to 30-second intervals.

#### NFR-REL-003: Update Reload Guard
Service worker updates shall trigger page reload, guarded against infinite reload loops via sessionStorage debounce.

#### NFR-REL-004: OTA Updates (iOS)
The iOS app shall check for and apply Capacitor OTA updates on app startup.

#### NFR-REL-005: API Retry Logic
Failed network requests shall retry up to 2 times (excluded when offline).

#### NFR-REL-006: Graceful Degradation
When Supabase is unreachable, the app shall display cached data and queue mutations for later sync.

#### NFR-REL-007: Error Boundaries
Critical UI errors shall be caught by React error boundaries with fallback UI.

### 4.3 Security

#### NFR-SEC-001: Row-Level Security
All Supabase tables shall enforce RLS policies ensuring data isolation between users.

#### NFR-SEC-002: Token-Based Auth
All API requests shall include valid JWT Supabase auth tokens.

#### NFR-SEC-003: Secure Config Storage
No secrets (Supabase keys, tokens) shall be committed to source control. Environment variables shall be used.

#### NFR-SEC-004: iCal Token Security
Calendar feed URLs shall include cryptographically random tokens preventing unauthorized access.

#### NFR-SEC-005: XSS Prevention
User-generated content (task descriptions, notes, event titles) shall be sanitized before rendering.

#### NFR-SEC-006: CSRF Protection
Supabase auth requests are inherently protected by JWT; custom API routes shall validate request origins.

#### NFR-SEC-007: Password Requirements
Signup password shall require minimum 8 characters with at least one uppercase, one lowercase, and one number.

#### NFR-SEC-008: Privacy Mode
Sensitive financial data shall support blur-on-render with hover-to-reveal for public screen protection.

#### NFR-SEC-009: Session-Aware Request Deduplication
The client-side API egress limiter (`src/lib/api-limiter.ts`) shall key its in-flight request deduplication cache by the request's `Authorization` header in addition to method, URL, and body, so that two different authenticated sessions hitting the same REST endpoint within the dedupe window can never be handed each other's cached response. The system shall also flush this cache on every sign-in, sign-out, and detected account switch (`clearAllUserDataCache`), preventing any residual cross-account data leakage on the same device.

### 4.4 Scalability

#### NFR-SCL-001: Horizontal Scaling
Vercel serverless functions and Supabase shall scale horizontally with user load.

#### NFR-SCL-002: Database Indexing
All frequently queried columns (user_id, date, created_at) shall be indexed in PostgreSQL.

#### NFR-SCL-003: Edge Function Limits
Supabase Edge Functions shall complete within regional timeout limits (default 150s).

#### NFR-SCL-004: Batch Processing
Offline queue replay shall support batch processing to reduce API call volume.

### 4.5 Usability

#### NFR-USE-001: Zero UI Tax
All CRUD operations shall be accessible within 2 clicks/taps via a consistent "details sheet" pattern.

#### NFR-USE-002: Keyboard Shortcuts
The application shall support keyboard navigation and shortcuts (global Ctrl/Cmd+Enter to submit forms).

#### NFR-USE-003: Touch Targets
All interactive elements on touch devices shall have minimum 25px touch targets (Apple HIG).

#### NFR-USE-004: Prevent iOS Zoom
All input fields on mobile shall use font-size >= 16px to prevent iOS zoom-on-focus.

#### NFR-USE-005: Theme Consistency
The application shall maintain consistent theming across all pages with no FOUC (inline theme script in HTML head).

#### NFR-USE-006: Loading States
All async data fetching shall display appropriate loading skeletons or spinners.

#### NFR-USE-007: Native Feel (iOS)
iOS builds shall feel native with liquid glass effects, haptic feedback, keyboard-aware layout, and safe area handling.

#### NFR-USE-008: Feedback on Actions
All user actions (task completion, habit log, transaction save) shall provide immediate visual and haptic feedback.

### 4.6 Maintainability

#### NFR-MNT-001: TypeScript Strict Mode
The application shall use TypeScript strict mode with `noUnusedLocals`, `noUnusedParameters`, and `noUncheckedSideEffectImports`.

#### NFR-MNT-002: Platform Abstraction
Platform-specific code (iOS, web, pake) shall be isolated via Vite's `.platform` resolution plugin avoiding conditional logic in shared code.

#### NFR-MNT-003: Monorepo Structure
Workspace packages (`lib/api-client-react`, `lib/api-spec`, `lib/api-zod`, `lib/db`) shall maintain clear boundaries and independent versioning.

#### NFR-MNT-004: Test Coverage
All utility functions and complex components shall have associated `.test.ts` or `.test.tsx` files.

#### NFR-MNT-005: Code Linting
All source code shall pass ESLint with recommended TypeScript, React Hooks, and React Refresh configurations.

#### NFR-MNT-006: Documentation
Each source file shall be documented in `CODEBASE_DOCUMENTATION.md` with purpose, functions, and line counts.

### 4.7 Portability

#### NFR-PORT-001: Browser Support
Web builds shall support Safari 13+, Chrome 80+, Firefox 75+, Edge 80+.

#### NFR-PORT-002: iOS Legacy Support
An iOS 6 lite mode shall provide basic HTML access for legacy devices.

#### NFR-PORT-003: Cross-Platform Build
The same React codebase shall build for web, iOS, and desktop via platform-specific Vite configurations.

#### NFR-PORT-004: Database Portability
SQLite (browser) and PostgreSQL (server) shall share compatible schema definitions via Drizzle ORM.

### 4.8 Accessibility

#### NFR-ACC-001: Semantic HTML
All components shall use semantic HTML elements (`<button>`, `<nav>`, `<main>`, `<article>`) with appropriate ARIA roles.

#### NFR-ACC-002: Focus Management
Modals and sheets shall trap focus, maintain focus order, and return focus on close.

#### NFR-ACC-003: Color Contrast
All text shall meet WCAG AA contrast ratios (4.5:1 for normal text, 3:1 for large text) in both light and dark themes.

#### NFR-ACC-004: Keyboard Navigation
All interactive elements shall be fully operable via keyboard alone.

#### NFR-ACC-005: Screen Reader Labels
All icon buttons and non-text controls shall have descriptive `aria-label` attributes.

---

## 5. External Interface Requirements

### 5.1 User Interfaces
- **Web:** Responsive SPA with PWA manifest, installable on mobile/desktop
- **iOS:** Native wrapper via Capacitor with WebView rendering, native status bar, keyboard handling, and push notifications
- **Desktop:** Pake-wrapped web app with HashRouter, system tray, and hide-on-close behavior. On Linux it uses native GNOME / Adwaita styling (via the `linux` platform UI override) with CSS blur disabled, an in-page GNOME-aligned titlebar with click-safe buttons, invisible boundary resize handles leveraging Tauri's `startResizeDragging` API, and harmonized background surface styling for the AI Assistant view. The launcher enables GPU compositing for WebKitGTK (via an `env WEBKIT_DISABLE_COMPOSITING_MODE=0 WEBKIT_DISABLE_DMABUF_RENDERER=0` prefix in the desktop entry) to keep the dashboard smooth. A single deduplicated `.desktop` entry is installed to avoid duplicate application-menu icons.

### 5.2 Hardware Interfaces
- **iOS:** Camera/Photos (for profile), Haptics, Push Notifications, Local Notifications, Badge, Deep Links
- **Desktop:** System Notifications (via Pake inject), Clipboard

### 5.3 Software Interfaces
| Interface | Technology | Purpose |
|-----------|-----------|---------|
| Supabase Client | `@supabase/supabase-js` | Auth, database queries, realtime subscriptions |
| Supabase Edge Functions | Deno/TypeScript | Notifications, SMS parsing, data sync, calendar feeds |
| Vercel API Routes | TypeScript/Vercel | Cron jobs, proxy, calendar task feeds |
| Bynara AI Router | Fetch API | OpenAI-compatible endpoint for tasks NLP, notes tools, receipt parsing, and wellness coaching |
| iCal Parser | Custom | Parse external calendar subscriptions |
| Adhan Library | `adhan` npm | Islamic prayer time calculation |
| Date Utilities | `date-fns` | Date formatting, manipulation, parsing |
| Charts | `recharts` | Analytics visualizations |
| React Query | `@tanstack/react-query` | Server state management, caching, synchronization |
| Zustand | `zustand` | Client state management with persistence |
| Push API | Web Push/VAPID | Browser push notifications |

### 5.4 Communication Interfaces
- **HTTPS:** All API calls over TLS 1.2+
- **WebSockets:** Supabase realtime for live data updates
- **Push Protocol:** VAPID for web push, APNs for iOS push

---

## 6. Data Requirements

### 6.1 Data Models
The system manages the following core entities (as defined in `src/types/schema.ts`):

#### User & Auth
- `users` (Supabase Auth managed)
- `user_app_settings` — theme, accent, nav order, widget visibility, targets

#### Tasks
- `tasks` — title, description, due_date, due_time, priority, recurrence, list_id, tag_ids, completed, archived
- `task_lists` — name, order, color
- `tags` — name, color

#### Habits
- `habits` — name, description, frequency, type, color, detox_config, archived
- `habit_logs` — habit_id, date, value, duration, status

#### Calendar
- `calendar_events` — title, date, time, timezone, location, recurrence, type, description
- `ical_subscriptions` — url, name, last_synced

#### Finance
- `transactions` — amount, category, description, date, time, direction, bank_id, type
- `user_banks` — name, icon, order
- `investment_accounts` — name, type, balance
- `investment_transactions` — account_id, amount, type, date

#### Health
- `inbody_scans` — weight, bmi, skeletal_muscle, body_fat, visceral_fat, bmr, date
- `sleep_sessions` — start_time, end_time, quality, score
- `sleep_stages` — session_id, type, start_time, end_time

#### Screen Time
- `screentime_app_stats` — app_name, category, duration, sessions, switches, date
- `screentime_website_stats` — domain, duration, sessions, date
- `screentime_daily_summaries` — date, total_duration, total_sessions, total_switches

#### Prayer
- `prayer_habits` — prayer_name, notification settings
- `prayer_logs` — prayer_name, date, status
- `prayer_notification_settings` — prayer_id, offset, sound, enabled

#### Notes
- `notes` — title, body, folder_id, created_at
- `note_folders` — name, order

#### Points
- `points_transactions` — user_id, amount, reason, date
- `custom_rewards` — name, cost, icon, color

#### Focus
- `focus_sessions` — task_id, start_time, end_time, duration, phase

### 6.2 Data Persistence
- **Primary:** Supabase PostgreSQL (cloud-synced)
- **Offline Queue:** IndexedDB (`lifeos_offline_queue` store)
- **Cache:** localStorage (React Query persisted cache, UI store state)
- **PWA Assets:** Service Worker CacheStorage (JS, CSS, HTML, icons, fonts)

### 6.3 Data Retention
- Deleted habits are soft-deleted (archived flag) to preserve historical data.
- Offline queue entries are removed after successful replay.
- React Query cache expires after 7 days.
- Analytics data is aggregated from raw tables; raw data retained per user preference.

### 6.4 Data Migration
- Zustand UI store uses migration functions to handle schema changes across app versions.
- Supabase database migrations managed via Supabase CLI.

---

*End of Software Requirements Specification*
