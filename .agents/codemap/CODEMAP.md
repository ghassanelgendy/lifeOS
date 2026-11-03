# lifeOS Code Map

> **Generated** — do not hand-edit. Regenerate with `node scripts/build-codemap.mjs`.
> Companions: [`graph.json`](./graph.json) (full node/edge graph), [`tables.json`](./tables.json) (data index).

**Read this file first.** It is designed so an agent can locate the right 2–5 files
for a task without grepping the tree. 286 source files,
116,621 LOC, 936 internal import edges.

## 0. How to use this map

1. Find your task in **§1 Task router**.
2. Confirm the file set in **§4 Feature map** (route → hook → tables).
3. **Before editing any file, check §3 Platform variants.** Editing only the file you
   opened is the single most common mistake in this repo.
4. Need callers/callees of a specific module? `jq` into `graph.json`:
   ```bash
   jq '.nodes[] | select(.id=="src/hooks/useTasks.web.ts") | {imports, importedBy}' .agents/codemap/graph.json
   jq -r '.tables[] | select(.table=="tasks") | .readWrite[]' .agents/codemap/tables.json
   ```

## 1. Task router

| If the task is… | Start here |
|---|---|
| Add/change a screen | `src/routes/<Name>.{web,ios,pake}.tsx` + route table in `src/App.web.tsx` + `src/components/navItems.ts` |
| Add/change persisted data | `src/hooks/use<Domain>.ts` (React Query) → `src/types/schema.ts` → `supabase/migrations/` |
| Networking / sync / egress | `src/lib/api-limiter.ts`, `src/lib/queryClient.ts`, `src/lib/offlineSync.ts` — **read `API_EGRESS_FIX.md` first** |
| Auth / session | `src/contexts/AuthContext.tsx`, `src/hooks/useAuth.ts` |
| Client-only UI state | `src/stores/use*Store.ts` (Zustand) — never put server state here |
| Server-side job / webhook | `supabase/functions/<name>/index.ts` (Deno) or `api/` (Vercel) |
| Scheduled job | `api/cron/*.ts` + `vercel.json` crons + `docs/CRON.md` |
| Notifications | `src/hooks/usePushNotifications.{web,ios,pake}.ts`, `src/lib/push.ts`, `supabase/functions/*-notifications-dispatch` |
| Native bridge (haptics/tray/badge) | `src/lib/nativeBridge.ts`, `src/hooks/useNative*.ts`, `src/lib/otaUpdater.ts` |
| Shared UI primitive | `src/components/ui/` (export via `src/components/ui/index.ts`) |
| Browser extension | `extension/` — separate codebase, duplicates its own Supabase client |
| Any feature-level change | **Also update `PRD.md`, `CODEBASE_SRS.md`, `CODEBASE_DOCUMENTATION.md`** (in-app Wiki reads them) |
| Verifying your change | `pnpm typecheck` • `pnpm lint` • `pnpm test` — note typecheck is *baselined*, see §8 |

## 2. Entry points & shell

```
index.html → src/main.tsx → src/App.tsx ──(.platform)──> App.web.tsx | App.ios.tsx
                                                              │
   PersistQueryClientProvider (localStorage, 7d)  ────────────┤
   AuthProvider → ErrorBoundary → AppInner                    │
                                                              ▼
   BrowserRouter (web) / HashRouter (pake)  →  ProtectedRoute → AppShell → <Outlet/>
```

Public routes: `/`, `/login`, `/signup`, `/wiki`, `/wiki/:pageTitle`.
Everything else sits behind `ProtectedRoute` + `AppShell`.

Background workers mounted once in `AppInner`: `useTransactionsRealtime`,
`useAzkarRealtime`, `usePakeLocalNotifications`, `useNativeTraySync`,
`useDailyPointsSync`, offline-queue drain, midnight brain-dump organizer.

## 3. Platform variants — read before editing

`.platform` is a **fake extension** rewritten at resolve time by
`platformResolvePlugin` (`vite.config.ts`, mirrored in `vitest.config.ts` pinned to `web`):

| mode | resolves `./X.platform` to |
|---|---|
| default / web | `X.web.tsx` |
| `--mode ios` | `X.ios.tsx` — **no fallback; missing file = build error** |
| `--mode pake` | `X.pake.tsx` if present, else `X.web.tsx` |

Bare `index.css` is rewritten the same way → `index.web.css` / `index.ios.css` / `index.pake.css`.

25 variant families exist. Families **missing an `.ios` variant are an
iOS-build risk**; families with `.pake` silently diverge from web.

| Base | shim | web | ios | pake |
|---|---|---|---|---|
| `App` | ✓ | ✓ | ✓ | · |
| `components/AppFooter` | ✓ | ✓ | ✓ | ✓ |
| `components/AppShell` | ✓ | ✓ | ✓ | ✓ |
| `components/CompactPrayerHabit` | ✓ | ✓ | ✓ | · |
| `components/dashboard/DashboardQuickView` | ✓ | ✓ | ✓ | · |
| `components/DataCard` | ✓ | ✓ | ✓ | · |
| `components/FinanceHeroCard` | ✓ | ✓ | ✓ | · |
| `components/PrayerBacklog` | ✓ | ✓ | ✓ | · |
| `components/PullToRefresh` | ✓ | ✓ | ✓ | · |
| `components/SwipeableRow` | ✓ | ✓ | ✓ | ✓ |
| `components/TaskDetailsContent` | ✓ | ✓ | ✓ | · |
| `components/ui/Button` | ✓ | ✓ | ✓ | · |
| `hooks/useHabits` | ✓ | ✓ | ✓ | · |
| `hooks/usePrayerHabits` | ✓ | ✓ | ✓ | · |
| `hooks/usePushNotifications` | ✓ | ✓ | ✓ | ✓ |
| `hooks/useTasks` | ✓ | ✓ | ✓ | · |
| `routes/Azkar` | ✓ | ✓ | ✓ | · |
| `routes/Calendar` | ✓ | ✓ | ✓ | ✓ |
| `routes/Finance` | ✓ | ✓ | ✓ | ✓ |
| `routes/Habits` | ✓ | ✓ | ✓ | · |
| `routes/Notes` | ✓ | ✓ | ✓ | · |
| `routes/Screentime` | ✓ | ✓ | ✓ | · |
| `routes/Settings` | ✓ | ✓ | ✓ | · |
| `routes/Sleep` | ✓ | ✓ | ✓ | · |
| `routes/Tasks` | ✓ | ✓ | ✓ | ✓ |

## 4. Feature map (route → hooks → tables)

| Route | Component | Primary hooks | Tables touched |
|---|---|---|---|
| `/analytics` | `Analytics` | useAnalytics, useAuth, useHabits, usePoints | custom_rewards, habit_logs, habits, points_transactions, prayer_habits, prayer_logs … (+1) |
| `/azkar` | `Azkar` | useAuth, useAzkar, useSleep | azkar_daily_progress, azkar_favorites, habit_logs, habits, sleep_stages |
| `/calendar` | `Calendar` | useAuth, useCalendar, useIcalSubscriptions, usePoints, useTaskCalendarFeed … (+1) | calendar_events, calendar_task_links, habits, notes, points_transactions, tags … (+4) |
| `/chat` | `Chat` | useAuth, useCalendar, useFinance, useHabits, useHealthData … (+6) | calendar_events, habit_logs, habits, inbody_scans, note_folders, notes … (+13) |
| `/dashboard` | `Dashboard` | useAuth, useCalendar, useHabits, useIcalSubscriptions, usePoints … (+1) | calendar_events, habit_logs, habits, notes, points_transactions, prayer_habits … (+5) |
| `/finance` | `Finance` | useAuth, useFinance, useInvestments, useUserBanks | investment_accounts, investment_transactions, transaction_rules, transactions, user_banks |
| `/focus` | `Focus` | useAuth, usePoints, useTasks | habits, notes, points_transactions, tags, task_lists, tasks |
| `/habits` | `Habits` | useAuth, useAzkar, useHabits, usePoints, useSleep | azkar_daily_progress, azkar_favorites, custom_rewards, habit_logs, habits, points_transactions … (+4) |
| `/health` | `Health` | useAuth, useHealthData | inbody_scans |
| — *(not mounted directly)* | `Landing` | — | — |
| `/login` | `Login` | useAuth | — |
| `/notes` | `Notes` | useAuth, useNotes, usePoints, useTasks | habit_logs, habits, note_folders, notes, points_transactions, prayer_logs … (+3) |
| `/points` | `Points` | useAuth, usePoints | custom_rewards, points_transactions, tasks |
| `/quran` | `Quran` | useAuth, useCalendar, useHabits, useIcalSubscriptions, useNotes … (+3) | calendar_events, habit_logs, habits, note_folders, notes, points_transactions … (+8) |
| `/screentime` | `Screentime` | useAuth, useScreentime | screentime_daily_app_stats, screentime_daily_summary, screentime_daily_website_stats |
| `/settings` | `Settings` | useAuth, useHabits, usePoints, usePrayerHabits, usePrayerTimes … (+2) | habit_logs, habits, notes, points_transactions, prayer_habits, prayer_logs … (+5) |
| `/signup` | `Signup` | useAuth | — |
| `/sleep` | `Sleep` | useAuth, useSleep | sleep_stages |
| `/tasks` | `Tasks` | useAuth, useCalendar, useHabits, useIcalSubscriptions, useNativeInteraction … (+3) | calendar_events, habit_logs, habits, notes, points_transactions, prayer_habits … (+6) |
| `/weekly-planner` | `WeeklyPlanner` | useAuth, useCalendar, useHabits, useIcalSubscriptions, useNotes … (+4) | calendar_events, habit_logs, habits, note_folders, notes, points_transactions … (+10) |
| `/wiki` `/wiki/:pageTitle` | `Wiki` | useAuth | — |

> Hook/table columns are computed transitively (depth ≤ 2) from import edges, so they
> show *reachable* data, not necessarily data used on first paint.

## 5. Data layer

- **Source of truth:** Supabase Postgres via `src/lib/supabase.ts`.
  `installApiLimiter()` runs **before** `createClient` so the SDK's own fetch is gated.
- **Cache/transport:** React Query (`src/lib/queryClient.ts`) — `staleTime` 30 min,
  `gcTime` 24 h, `refetchOnWindowFocus: false`, `refetchOnReconnect: true`.
  `invalidateQueries` is monkey-patched to **no-op during limiter emergency mode**.
- **Legacy/offline cache:** `src/db/database.ts`, `src/db/indexedDb.ts` — *not* source of truth.
- **Offline writes:** queued in `src/lib/offlineSync.ts`, drained on `online` +
  `visibilitychange` + a 120 s interval + service-worker message.

### Tables by consumer count

| Table | Modules |
|---|---|
| `tasks` | 19 — components/dashboard/DashboardQuickView.ios.tsx, components/dashboard/DashboardQuickView.web.tsx, hooks/useCalendar.ts, hooks/usePoints.ts … (+15) |
| `habit_logs` | 12 — hooks/useAzkar.ts, hooks/useHabits.ios.ts, hooks/useHabits.web.ts, hooks/usePrayerHabits.ios.ts … (+8) |
| `habits` | 11 — db/seed.ts, hooks/useAzkar.ts, hooks/useHabits.ios.ts, hooks/useHabits.web.ts … (+7) |
| `notes` | 10 — App.ios.tsx, App.web.tsx, hooks/useNotes.ts, hooks/useTasks.ios.ts … (+6) |
| `prayer_logs` | 9 — App.ios.tsx, components/PrayerBacklog.ios.tsx, components/PrayerBacklog.web.tsx, hooks/useHabits.ios.ts … (+5) |
| `prayer_habits` | 8 — components/PrayerBacklog.ios.tsx, components/PrayerBacklog.web.tsx, hooks/useHabits.ios.ts, hooks/useHabits.web.ts … (+4) |
| `push_subscriptions` | 8 — hooks/usePushNotifications.ios.ts, hooks/usePushNotifications.web.ts, supabase/functions/calendar-notifications-dispatch/index.ts, supabase/functions/habit-notifications-dispatch/index.ts … (+4) |
| `tags` | 8 — db/seed.ts, hooks/useTasks.ios.ts, hooks/useTasks.web.ts, routes/Calendar.ios.tsx … (+4) |
| `points_transactions` | 7 — hooks/useHabits.ios.ts, hooks/useHabits.web.ts, hooks/usePoints.ts, hooks/usePrayerHabits.ios.ts … (+3) |
| `note_folders` | 5 — App.ios.tsx, App.web.tsx, hooks/useNotes.ts, supabase/functions/append-braindump/index.ts … (+1) |
| `task_lists` | 5 — hooks/useTasks.ios.ts, hooks/useTasks.web.ts, supabase/functions/braindump-organizer/index.ts, supabase/functions/create-task/index.ts … (+1) |
| `transactions` | 5 — hooks/useFinance.ts, hooks/useUserBanks.ts, supabase/functions/process-sms/index.ts, supabase/functions/quick-expense/index.ts … (+1) |
| `calendar_events` | 4 — hooks/useCalendar.ts, api/calendar/tasks.ts, supabase/functions/calendar-feed/index.ts, supabase/functions/calendar-notifications-dispatch/index.ts |
| `prayer_notification_settings` | 4 — App.ios.tsx, hooks/usePrayerHabits.ios.ts, hooks/usePrayerHabits.web.ts, supabase/functions/prayer-notifications-dispatch/index.ts |
| `user_app_settings` | 4 — hooks/useUserAppSettingsSync.ts, supabase/functions/braindump-organizer/index.ts, supabase/functions/process-sms/index.ts, supabase/functions/quick-expense/index.ts |
| `calendar_task_links` | 3 — routes/Calendar.ios.tsx, routes/Calendar.pake.tsx, routes/Calendar.web.tsx |
| `screentime_daily_app_stats` | 3 — hooks/useScreentime.ts, supabase/functions/upload-screentime/index.ts, supabase/functions/upload-screentime-chronos/index.ts |
| `screentime_daily_summary` | 3 — hooks/useScreentime.ts, supabase/functions/upload-screentime/index.ts, supabase/functions/upload-screentime-chronos/index.ts |
| `screentime_daily_website_stats` | 3 — hooks/useScreentime.ts, supabase/functions/upload-screentime/index.ts, supabase/functions/upload-screentime-chronos/index.ts |
| `task_calendar_feeds` | 3 — hooks/useTaskCalendarFeed.ts, api/calendar/tasks.ts, supabase/functions/calendar-feed/index.ts |
| `transaction_rules` | 3 — hooks/useFinance.ts, supabase/functions/process-sms/index.ts, supabase/functions/quick-expense/index.ts |
| `inbody_scans` | 2 — hooks/useHealthData.ts, supabase/functions/sync-inbody/index.ts |
| `quran_khatmah_plans` | 2 — hooks/useQuranCloudSync.ts, supabase/functions/habit-notifications-dispatch/index.ts |
| `sleep_stages` | 2 — hooks/useSleep.ts, supabase/functions/upload-sleep/index.ts |
| `azkar_daily_progress` | 1 — hooks/useAzkar.ts |
| `azkar_favorites` | 1 — hooks/useAzkar.ts |
| `budgets` | 1 — supabase/functions/process-sms/index.ts |
| `custom_rewards` | 1 — hooks/usePoints.ts |
| `investment_accounts` | 1 — hooks/useInvestments.ts |
| `investment_transactions` | 1 — hooks/useInvestments.ts |

Full index (every table + every consumer): `tables.json`.

### Edge functions

| Function | Defined | Called from |
|---|---|---|
| `append-braindump` | ✓ | — (cron/webhook only) |
| `braindump-organizer` | ✓ | api/cron/braindump-organizer.ts |
| `calendar-feed` | ✓ | hooks/useTaskCalendarFeed.ts |
| `calendar-notifications-dispatch` | ✓ | api/cron/calendar-notifications-dispatch.ts |
| `create-task` | ✓ | — (cron/webhook only) |
| `habit-notifications-dispatch` | ✓ | api/cron/habit-notifications-dispatch.ts |
| `prayer-notifications-dispatch` | ✓ | api/cron/prayer-notifications-dispatch.ts |
| `process-sms` | ✓ | routes/Settings.ios.tsx |
| `quick-expense` | ✓ | — (cron/webhook only) |
| `r2-presign` | ✓ | — (cron/webhook only) |
| `reconcile-statement` | ✓ | — (cron/webhook only) |
| `report-notification-dispatch` | ✓ | — (cron/webhook only) |
| `send-task-reminders` | ✓ | api/cron/send-task-reminders.ts |
| `send-test-notification` | ✓ | hooks/usePushNotifications.ios.ts, hooks/usePushNotifications.web.ts |
| `sync-inbody` | ✓ | — (cron/webhook only) |
| `sync-reminders` | ✓ | — (cron/webhook only) |
| `upload-screentime` | ✓ | — (cron/webhook only) |
| `upload-screentime-chronos` | ✓ | — (cron/webhook only) |
| `upload-sleep` | ✓ | routes/Settings.ios.tsx, routes/Sleep.ios.tsx |

## 6. Change-risk hubs

Most-imported modules — editing these has the widest blast radius.

| Module | Imported by | Kind | LOC |
|---|---|---|---|
| `src/lib/utils.ts` | 94 | lib | 55 |
| `src/types/schema.ts` | 60 | types | 474 |
| `src/stores/useUIStore.ts` | 52 | store | 678 |
| `src/hooks/useAuth.ts` | 44 | hook | 14 |
| `src/lib/supabase.ts` | 44 | lib | 41 |
| `src/components/ui/index.ts` | 35 | ui-primitive | 6 |
| `src/hooks/useTasks.ts` | 23 | hook | 2 |
| `src/hooks/useHabits.ts` | 19 | hook | 2 |
| `src/lib/ai.ts` | 19 | lib | 455 |
| `src/lib/offlineSync.ts` | 19 | lib | 170 |
| `src/db/indexedDb.ts` | 18 | local-db | 626 |
| `src/hooks/useCalendar.ts` | 18 | hook | 272 |
| `src/lib/nativeBridge.ts` | 15 | lib | 960 |
| `src/hooks/usePoints.ts` | 14 | hook | 450 |
| `lib/quran-memorizer/src/services/quranData.ts` | 13 | workspace-pkg | 735 |
| `lib/quran-memorizer/src/types/quran.ts` | 12 | workspace-pkg | 142 |
| `src/hooks/useSleep.ts` | 11 | hook | 195 |
| `src/hooks/useAzkar.ts` | 10 | hook | 509 |
| `src/lib/prayerStatus.ts` | 10 | lib | 10 |
| `src/lib/analytics-utils.ts` | 9 | lib | 148 |

## 7. Hooks inventory

| Hook | Variants | Exports |
|---|---|---|
| `useAnalytics` | single | AnalyticsDailyFinanceRow, AnalyticsDailyHabitsRow, AnalyticsDailyScreentimeRow, AnalyticsDailySleepRow, AnalyticsDailyTasksRow … (+9) |
| `useAuth` | single | useAuth |
| `useAzkar` | single | CATEGORY_METADATA, getAzkarHabitCategory, stripTashkeel, useAllAzkar, useAzkarCategories … (+4) |
| `useCalendar` | single | useCalendarEvents, useCreateCalendarEvent, useDeleteCalendarEvent, useExpandedCalendarEvents, useIcalSubscriptionEvents … (+4) |
| `useConnectionStatus` | single | useConnectionStatus |
| `useDashboardUpcomingItems` | single | DashboardUpcomingItem, DashboardUpcomingItemKind, habitMatchesDay, isHabitShownInQuickView, useDashboardUpcomingItems |
| `useFinance` | single | getBreakdownFromTransactions, useCategoryBreakdown, useCreateTransaction, useDeleteTransaction, useFinancialSummary … (+3) |
| `useHabits` | web/ios | HabitInsight, formatHourLabel, getHabitAdherenceWeight, getHabitRescueCost, getHabitStreak … (+19) |
| `useHealthData` | single | useCreateInBodyScan, useDeleteInBodyScan, useHealthMetrics, useInBodyScan, useInBodyScans … (+1) |
| `useIcalSubscriptions` | single | IcalSubscription, useIcalSubscriptions |
| `useInvestments` | single | INVESTMENT_TRANSACTION_TYPES, InvestmentTransactionTypeValue, getInvestmentAccountBalance, getInvestmentBreakdown, useAddInvestmentAccount … (+8) |
| `useNativeInteraction` | single | useNativeInteraction |
| `useNativeLocalNotifications` | single | useNativeLocalNotifications |
| `useNativeTraySync` | single | useNativeTraySync |
| `useNotes` | single | useCreateNote, useCreateNoteFolder, useDeleteNote, useDeleteNoteFolder, useNoteFolders … (+4) |
| `usePakeLocalNotifications` | single | usePakeLocalNotifications |
| `usePoints` | single | CUSTOM_REWARDS_KEY, POINTS_TX_KEY, PointsConfig, getPointsConfig, isDateEligibleForPoints … (+11) |
| `usePrayerHabits` | web/ios | PrayerTrackerItem, usePrayerNotificationSettings, usePrayerTracker, useSetPrayerStatusAtDate |
| `usePrayerTimes` | single | PrayerTimeData, usePrayerTimes |
| `usePushNotifications` | web/ios/pake | usePushNotifications |
| `useQuranCloudSync` | single | useQuranCloudSync |
| `useReport` | single | DayMetrics, Outlier, ReportData, TopApp, TopCategory … (+4) |
| `useScreentime` | single | useScreentimeAppStats, useScreentimeDailySummaries, useScreentimeMetrics, useScreentimeWebsiteStats, useTodayScreentime |
| `useSleep` | single | groupSegmentsByNight, useLastNightSleepMinutes, useSleepMetrics, useSleepMinutesForDay, useSleepStages |
| `useSyncStatus` | single | useSyncStatus |
| `useTaskCalendarFeed` | single | TaskCalendarFeed, useTaskCalendarFeed |
| `useTasks` | web/ios | syncTaskCompletionToLinkedNote, useBatchDeleteTasks, useCompletedTasks, useConvertTaskToHabit, useCreateSubtask … (+21) |
| `useUserAppSettingsSync` | single | useUserAppSettingsSync |
| `useUserBanks` | single | DEFAULT_BANK_NAMES, useAddBank, useEnsureDefaultBanks, useRemoveBank, useRenameBank … (+1) |

## 8. Invariants / landmines

1. **No polling.** Short-interval `setInterval` refetch loops caused an egress
   incident (`API_EGRESS_FIX.md`). Don't shorten `staleTime`/`gcTime`; don't add
   refetch intervals. `screentime` and `sleep` are deliberately throttled.
2. **All Supabase traffic goes through `src/lib/supabase.ts`** so the limiter wraps it.
   A bare `fetch` to Supabase bypasses the circuit breaker.
3. **Edit every platform variant**, not just the one you opened (§3).
4. **Server state → React Query. Client UI state → Zustand.** Don't mix.
5. **Docs sync is mandatory** for feature changes: `PRD.md`, `CODEBASE_SRS.md`,
   `CODEBASE_DOCUMENTATION.md` feed the in-app Wiki (`src/lib/wikiData.ts`).
6. **TypeScript is pinned oddly** (`typescript` → `@typescript/typescript6`, plus a
   `@typescript/native` 7.x devDep). `scripts/lint.mjs` self-skips on TS 7.x — that is
   intentional; don't "fix" it by downgrading TS.
7. **`extension/` is standalone** vanilla JS with its own Supabase/AI client. Changes in
   `src/lib` do **not** propagate there.
8. **`pnpm typecheck` is a baselined gate, not a clean build.** Root `tsconfig.json` is a
   solution file (`"files": []` + `references`) and plain `tsc --noEmit` follows no
   references — so the old gate checked *zero* files and always passed, hiding 79 genuine
   `TS2304 Cannot find name` bugs (since fixed). `scripts/typecheck.mjs` now:
   - checks `tsconfig.app.json` + `tsconfig.node.json`;
   - structurally drops `.platform` resolution errors — `tsc` cannot follow the fake
     extension, and every `TS2305` in the tree is verified to come from one of the 25
     shim families, so this is a build-design artifact rather than a defect;
   - fails only on errors absent from `scripts/typecheck-baseline.json`.

   | command | purpose |
   |---|---|
   | `pnpm typecheck` | the gate — fails on new errors only |
   | `pnpm typecheck:raw` | unfiltered `tsc` output |
   | `pnpm typecheck:baseline` | re-record the baseline after fixing debt (shrink, don't grow) |

   Pre-existing debt is baselined (mostly implicit-`any` params and unused vars).
   A green gate means *no regression*, not a clean tree.
9. Gate checks before done: `pnpm typecheck` • `pnpm lint` • `pnpm test`.

## 9. Possibly-unreferenced modules

No inbound import edges found. Some are legitimately entry points or
dynamically/string-referenced — verify before deleting.

- `src/components/PrayerTimesWidget.tsx` (component, 75 LOC)
- `src/hooks/useNativeLocalNotifications.ts` (hook, 58 LOC)
- `lib/api-client-react/src/index.ts` (workspace-pkg, 5 LOC)
- `lib/api-zod/src/index.ts` (workspace-pkg, 3 LOC)
- `lib/db/src/index.ts` (workspace-pkg, 17 LOC)
- `lib/quran-memorizer/src/index.ts` (workspace-pkg, 12 LOC)

## 10. Counts

- component: 75
- route: 42
- hook: 38
- lib: 30
- workspace-pkg: 22
- edge-fn: 21
- test: 14
- ui-primitive: 10
- extension: 7
- app-entry: 6
- vercel-cron: 5
- store: 4
- vercel-fn: 4
- local-db: 3
- types: 3
- context: 1
- static-data: 1
