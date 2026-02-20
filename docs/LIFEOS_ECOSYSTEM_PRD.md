# LifeOS Ecosystem PRD (Feature Scope v1)

## 1) Objective
Build an integrated LifeOS ecosystem where Prayer, Habits, Calendar, Tasks, Sleep, and Notifications work as one connected system with strong mobile UX.

This PRD includes only the features discussed:
- Prayer tracking linked to habits
- Prayer notifications via cron website and Supabase Edge Function
- Sleep analytics dashboard and session timeline visualization
- Full dashboard customization across pages
- Calendar event to task linkage with `calendar` tag
- iPhone modal and popup UX standardization (bottom sheet pattern)
- Habits section stabilization
- Recurring tasks redesign
- Task reminder opt-in (no default auto-notification)

## 2) Product Principles
- Ecosystem-first: cross-module links are visible and reliable.
- Mobile-first UX: interactions must be smooth on iPhone.
- Clear status at a glance: summary metrics first, details on demand.
- Safe defaults: notifications are explicit opt-in for tasks.

## 3) Feature Requirements

## 3.1 Prayer Tracking (Connected to Habits)
### User Story
As a user, I want to track daily prayers and have them count as habits so my faith routine is represented in habits, streaks, and dashboards.

### Functional Requirements
- Track prayers: `Fajr`, `Dhuhr`, `Asr`, `Maghrib`, `Isha`.
- Each prayer maps to a corresponding habit record (1:1 per user).
- Prayer status per day: `Prayed`, `Missed`, `Skipped`.
- Logging a prayer updates:
  - prayer tracking record
  - linked `habit_logs` entry for that date
- Prayer completion contributes to habit streak and completion metrics.
- Views:
  - Day checklist
  - Week and month completion trends

### Acceptance Criteria
- User can log each prayer in max 2 taps from mobile.
- Editing prayer status updates linked habit state consistently.
- No duplicate log for same `user + date + prayer`.

## 3.2 Prayer Notifications (Cron -> Supabase Edge Function)
### User Story
As a user, I want prayer reminders delivered reliably at the right time without relying on the app being open.

### Functional Requirements
- External cron service triggers a secured Supabase Edge Function endpoint.
- Edge Function computes due reminders using user timezone and settings.
- Per-prayer controls:
  - enabled/disabled
  - offset in minutes
  - quiet hours support
- Push delivery uses existing `push_subscriptions`.
- Idempotency required to prevent duplicate sends.

### Acceptance Criteria
- Reminder triggers correctly for enabled prayers only.
- Disabled prayers send no reminder.
- Duplicate sends are prevented for same reminder window.

## 3.3 Sleep Section: Score + Session Timeline + Metrics
### User Story
As a user, I want a clear daily sleep performance view and a detailed timeline showing sleep stages across the night.

### Functional Requirements
- Top tabs: `Day`, `Week`, `Month`, `Year`.
- Day view default active.
- Header actions: back arrow (left), calendar and menu (right), centered date.
- Score section includes:
  - sleep score (example: `92`)
  - star rating
  - comparison text (example: `Better than 99% of users`)
  - donut chart for stage proportions
  - mini weekly bar chart
- Sleep stage timeline:
  - horizontal time axis from sleep start to wake time (example 1 AM to 9 AM)
  - stage transitions plotted across session duration
- Stage colors:
  - Deep: dark purple
  - Light/Core: light purple
  - REM: red
  - Awake: yellow
- Session metric cards:
  - Night sleep duration (with reference 6-10 h)
  - Deep sleep percentage (reference 20-60%)
  - Light sleep percentage (reference <55%)
  - REM percentage (reference 10-30%)
  - Deep sleep continuity score (reference 70-100)
  - Times woke up (reference 0-1)
- Each card shows:
  - metric name
  - value
  - reference
  - status indicator (`Normal` or `Within range`)

### Acceptance Criteria
- Opening a sleep session shows full timeline and all key metrics.
- Stage durations and percentages match stored session/stage data.
- User can interpret bedtime, wake time, and stage transitions quickly.

## 3.4 Fully Customizable Dashboards (All Pages)
### User Story
As a user, I want to customize all dashboards by adding, removing, sorting, and arranging blocks based on my priorities.

### Functional Requirements
- For each dashboard page, user can:
  - add widgets
  - remove widgets
  - show/hide widgets
  - reorder widgets (drag and drop)
  - configure widget settings
- Per-page persistence of layout preferences.
- Reset to default layout per page.
- Widget library allows re-adding removed widgets.

### Acceptance Criteria
- Layout changes persist across sessions and reloads.
- Reset restores baseline defaults with one action.

## 3.5 Calendar Event -> Task Link (Tag: `calendar`)
### User Story
As a user, I want to enable a calendar event as a task so it appears in Tasks and stays linked.

### Functional Requirements
- In event create/edit/details, provide toggle: `Enable as Task`.
- When enabled, create linked task with:
  - title from event title
  - due date/time from event start
  - `calendar` tag attached
  - source link to event
- Maintain explicit event-task link record.
- Sync behavior:
  - Event time/title updates propagate to linked task unless detached.
  - Completing linked task does not auto-delete or alter event unless explicitly chosen.

### Acceptance Criteria
- Enabling link creates visible task with `calendar` tag.
- Linked updates are consistent and traceable.

## 3.6 Mobile Modals and Popups (iPhone UX Standard)
### User Story
As a mobile user, I want all modals/popups to open from bottom in a consistent way with proper spacing and safe-area handling.

### Functional Requirements
- Replace mobile center modals with a single bottom-sheet pattern.
- Bottom-sheet behavior:
  - enters from bottom
  - has top rounded corners
  - includes small visual gap and respects safe area
  - supports backdrop tap close
  - supports swipe-down close where appropriate
- Apply pattern consistently to all modal and popup entry points on mobile.

### Acceptance Criteria
- No desktop-style center modal appears on iPhone.
- Sheet placement does not clash with notch/home indicator.

## 3.7 Habits Section Stabilization
### User Story
As a user, I need habits to work reliably for create/edit/log/complete flows.

### Functional Requirements
- Fix all blocking issues in habits:
  - create habit
  - edit habit
  - archive/unarchive
  - log completion
  - undo completion
- Ensure date handling is timezone-safe for daily logs.
- Ensure streak calculations remain correct after edits and backfills.

### Acceptance Criteria
- Habits flows are stable with no known critical blockers.
- Completion state and streak counts remain consistent.

## 3.8 Recurring Tasks Redesign
### User Story
As a user, I want to define recurring tasks with clear interval and end rules.

### Functional Requirements
- Recurrence setup must ask:
  - frequency unit: `hourly`, `daily`, `weekly`, `monthly`, `yearly`
  - interval: every N units
  - end condition:
    - never
    - on specific date
    - after N occurrences
- Weekly recurrence supports day-of-week selection.
- Recurrence preview should show next few occurrences before save.

### Acceptance Criteria
- Created recurrence produces expected future instances.
- Hourly and weekly rules both work correctly.

## 3.9 Task Reminder Opt-In
### User Story
As a user, I want to choose whether a task has reminders instead of reminders being forced by default.

### Functional Requirements
- During task create/edit ask: `Enable reminders?` default `No`.
- If enabled, user can add one or multiple reminders.
- If not enabled, no task notification should be scheduled.
- Existing tasks must be migrated to explicit reminder behavior.

### Acceptance Criteria
- Tasks without reminders never trigger notifications.
- Reminder-enabled tasks trigger only configured reminders.

## 4) Design Requirements
- Sleep dashboard visual style:
  - soft gray page background
  - white cards
  - purple as primary accent
  - green for `Normal`
  - blue for `Within range`
  - rounded corners and strong visual hierarchy
- Keep interfaces clean, data-focused, and fast to parse.

## 5) Data Model and Schema Updates
The following schema updates are required to support the ecosystem behavior.

## 5.1 New Table: `prayer_habits`
- `id uuid pk default uuid_generate_v4()`
- `user_id uuid fk auth.users(id)`
- `prayer_name text not null` check in (`Fajr`,`Dhuhr`,`Asr`,`Maghrib`,`Isha`)
- `habit_id uuid not null fk habits(id)`
- `default_time time`
- `is_active boolean default true`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`
- Constraints:
  - unique (`user_id`, `prayer_name`)
  - unique (`habit_id`)

## 5.2 New Table: `prayer_logs`
- `id uuid pk default uuid_generate_v4()`
- `user_id uuid fk auth.users(id)`
- `prayer_habit_id uuid not null fk prayer_habits(id)`
- `date date not null`
- `status text not null` check in (`Prayed`,`Missed`,`Skipped`)
- `prayed_at timestamptz`
- `habit_log_id uuid fk habit_logs(id)`
- `notes text`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`
- Constraints:
  - unique (`user_id`, `prayer_habit_id`, `date`)

## 5.3 New Table: `prayer_notification_settings`
- `id uuid pk default uuid_generate_v4()`
- `user_id uuid fk auth.users(id)`
- `prayer_habit_id uuid not null fk prayer_habits(id)`
- `enabled boolean default true`
- `offset_minutes integer default 0`
- `timezone text not null`
- `quiet_hours_start time`
- `quiet_hours_end time`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`
- Constraints:
  - unique (`user_id`, `prayer_habit_id`)

## 5.4 New Table: `calendar_task_links`
- `id uuid pk default uuid_generate_v4()`
- `user_id uuid fk auth.users(id)`
- `calendar_event_id uuid not null fk calendar_events(id)`
- `task_id uuid not null fk tasks(id)`
- `sync_mode text default 'event_to_task'`
- `is_active boolean default true`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`
- Constraints:
  - unique (`calendar_event_id`, `task_id`)

## 5.5 New Table: `dashboard_widget_preferences`
- `id uuid pk default uuid_generate_v4()`
- `user_id uuid fk auth.users(id)`
- `page_key text not null`
- `widget_key text not null`
- `is_visible boolean default true`
- `sort_order integer default 0`
- `size text`
- `position jsonb`
- `settings jsonb default '{}'::jsonb`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`
- Constraints:
  - unique (`user_id`, `page_key`, `widget_key`)

## 5.6 New Table (Recommended): `task_reminders`
- `id uuid pk default uuid_generate_v4()`
- `user_id uuid fk auth.users(id)`
- `task_id uuid not null fk tasks(id)`
- `remind_at timestamptz not null`
- `channel text default 'push'`
- `is_active boolean default true`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

## 5.7 New Table (Recommended): `notification_delivery_logs`
- `id uuid pk default uuid_generate_v4()`
- `user_id uuid fk auth.users(id)`
- `source_type text not null` check in (`task`,`prayer`)
- `source_id uuid`
- `scheduled_for timestamptz not null`
- `sent_at timestamptz`
- `status text not null` check in (`pending`,`sent`,`failed`,`skipped`)
- `error text`
- `idempotency_key text`
- `created_at timestamptz default now()`
- Constraint:
  - unique (`idempotency_key`)

## 5.8 Update Existing Table: `tasks`
Add fields to support recurrence and reminder opt-in:
- `reminders_enabled boolean default false`
- `recurrence_unit text` check in (`hourly`,`daily`,`weekly`,`monthly`,`yearly`)
- `recurrence_interval integer default 1`
- `recurrence_days integer[]`
- `recurrence_end_type text` check in (`never`,`on_date`,`after_count`)
- `recurrence_end_date date`
- `recurrence_count integer`

## 5.9 Update Existing Table: `habit_logs`
Add optional traceability:
- `source text default 'manual'` check in (`manual`,`prayer`,`auto`)

## 6) Notifications Architecture
Cron website -> Supabase Edge Functions:
- `prayer-notifications-dispatch`: prayer reminder dispatch.
- `task-reminders-dispatch`: task reminder dispatch (only where `reminders_enabled = true`).

Both functions must:
- validate shared secret
- be idempotent
- write delivery logs
- be timezone-aware

## 7) Non-Functional Requirements
- Mobile performance: bottom-sheet open/close is smooth and stable.
- Reliability: reminder dispatch must handle retries safely.
- Data integrity: prayer-habit-task-calendar links remain consistent after edits.
- Timezone correctness: all schedule decisions use user timezone.

## 8) Rollout Priority
1. Habits stabilization and task reminder opt-in fix.
2. Recurring task redesign (unit/interval/end condition).
3. Calendar event to task linkage with `calendar` tag.
4. Prayer tracking with habit linkage.
5. Prayer notification pipeline (cron + edge function).
6. Dashboard customization system.
7. Sleep analytics UI enhancements.
8. Mobile modal and popup unification across screens.

## 9) Release Acceptance Checklist
- Prayer logs and habit logs stay in sync.
- No task sends notification unless reminders are enabled.
- Recurrence handles hourly through yearly with valid end conditions.
- Calendar-linked task appears with `calendar` tag and syncs correctly.
- iPhone modals and popups use the unified bottom-sheet UX.
- Sleep day view shows score, timeline, and metric cards correctly.
- Dashboard widgets can be added, removed, reordered, and persisted.
