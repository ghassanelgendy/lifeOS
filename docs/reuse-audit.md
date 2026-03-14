# Reuse Audit

## 1. Executive Summary

- Overall architecture observations:
  - The codebase already has reusable foundations: `src/components/ui` primitives, `src/lib/utils.ts`, `src/lib/supabase.ts`, `src/lib/queryClient.ts`, `src/lib/offlineSync.ts`, and shared entity contracts in `src/types/schema.ts`.
  - Most duplication comes from feature-level bypassing of existing primitives, not from lack of primitives.
  - Supabase + React Query patterns are consistent in intent but heavily repeated across hooks.
- Biggest duplication problems:
  - Repeated card and metric JSX across route files.
  - Repeated button/input class patterns in large route components.
  - Repeated CRUD + query-key + invalidation + user filter logic across hooks.
  - Repeated Vercel handler auth/bootstrap logic despite existing `api/lib/supabaseServer.ts`.
- Highest-value refactoring opportunities:
  - Standardize on existing `Button`, `Input`, `Modal`, `ConfirmSheet`, `DetailsSheet`.
  - Introduce shared `Card`/`MetricCard` primitives and migrate route cards incrementally.
  - Extract a shared user-scoped data hook helper (query + mutation + invalidation + offline queue adapter).
  - Consolidate API auth/client bootstrapping into `api/lib/supabaseServer.ts` only.
- Risks and constraints to avoid breaking behavior:
  - Offline queue behavior must remain unchanged during hook refactors.
  - Mobile sheet interactions are highly tuned; avoid changing UX while deduplicating internals.
  - TickTick mappings/token refresh are integration-critical; refactor with endpoint smoke tests.
  - Keep refactors incremental and behavior-preserving.

## 2. Shared Components Inventory

| Name | Path | Category | Purpose | Public API / props summary | Current usage locations | Canonical shared primitive? |
|---|---|---|---|---|---|---|
| Button | `src/components/ui/Button.tsx` | UI | Core action button with variants/sizes | `variant`, `size`, native button props | `Login`, `Signup`, `Tasks`, `Calendar`, `Finance`, `Settings`, `Focus`, `Habits`, `Health`, `Academics` | Yes |
| Input | `src/components/ui/Input.tsx` | UI/Form | Labeled input with error rendering | `label`, `error`, native input props | Used in auth and multiple forms | Yes |
| Select | `src/components/ui/Input.tsx` | UI/Form | Labeled select with error rendering | `label`, `error`, `options`, native select props | Used in forms/routes | Yes |
| TextArea | `src/components/ui/Input.tsx` | UI/Form | Labeled textarea with error rendering | `label`, `error`, native textarea props | Used in forms/routes | Yes |
| Modal | `src/components/ui/Modal.tsx` | UI/Overlay | Generic modal/sheet wrapper | `isOpen`, `onClose`, `title`, `swipeToClose`, `children` | `Tasks`, `Calendar`, `Health`, `Habits`, `Academics` | Yes |
| ConfirmSheet | `src/components/ui/ConfirmSheet.tsx` | UI/Overlay | Confirmation dialog/sheet | labels, `confirmVariant`, loading + handlers | Widely used in route delete/confirm flows | Yes |
| DetailsSheet | `src/components/ui/DetailsSheet.tsx` | UI/Overlay | Mobile-first details editing sheet | `isOpen`, `onClose`, `onConfirm`, `confirmDisabled`, `children` | `Tasks`, `Finance` | Yes |
| AppShell | `src/components/AppShell.tsx` | Layout | Global shell/navigation and page framing | no props; exports `NAV_ITEMS` | Route shell in `App.tsx` | Yes |
| PullToRefresh | `src/components/PullToRefresh.tsx` | Interaction | Pull/scroll wrapper for content area | `children` | Used by `AppShell` | Yes |
| OfflineBanner | `src/components/OfflineBanner.tsx` | Status | Offline indicator + pending sync count | internal state only | Used by `AppShell` | Yes |
| DataCard | `src/components/DataCard.tsx` | Display | Metric card with optional sparkline | `title`, `value`, `trend`, `data`, `unit`, `invertTrend` | Not currently consumed by route pages | Candidate |
| `cn`, formatter utils | `src/lib/utils.ts` | Utility | Class merging + formatting helpers | `cn`, `round1`, `formatCurrency`, `formatTime12h`, `formatDuration` | Broad usage | Yes |
| Supabase client | `src/lib/supabase.ts` | Data | Browser Supabase singleton | exported `supabase` | Auth + hooks + sync | Yes |
| Query client | `src/lib/queryClient.ts` | Data | React Query defaults/retries/cache | exported `queryClient` | App bootstrap and hooks | Yes |
| Offline sync | `src/lib/offlineSync.ts` | Data | Queue/replay offline mutations | queue add/process + status helpers | Mutation hooks and status hooks | Yes |
| App schema types | `src/types/schema.ts` | Types | Core domain entities + utility input types | Interfaces + `CreateInput`/`UpdateInput` | Hooks/routes | Yes |
| Supabase server helpers | `api/lib/supabaseServer.ts` | Server | Shared server auth/client bootstrap | `getSupabaseAnon`, `getSupabaseService`, `getUserIdFromRequest` | Available but not consistently used | Yes |
| TickTick server helpers | `api/lib/ticktick.ts` | Integration | Token refresh + fetch + mapping helpers | helper methods and mapper functions | Used by some handlers | Yes |

## 3. Duplication Findings

### Buttons
- Duplicated files/locations:
  - `src/components/TaskDetailsContent.tsx`
  - `src/components/AppShell.tsx`
  - `src/components/CompactPrayerHabit.tsx`
  - `src/routes/Tasks.tsx`
- What is repeated:
  - Repeated raw button class groups and interaction styles instead of extending `Button`.
- Severity: high
- Recommended consolidation target:
  - `src/components/ui/Button.tsx` (add `icon`, `toggle`, `segmented` variants if needed)
- Safety notes:
  - Preserve current ARIA roles and touch interactions.

### Cards
- Duplicated files/locations:
  - `src/routes/Dashboard.tsx`
  - `src/routes/Finance.tsx`
  - `src/routes/Academics.tsx`
  - `src/components/CompactPrayerHabit.tsx`
  - `src/components/PrayerBacklog.tsx`
- What is repeated:
  - `rounded-xl border border-border bg-card` wrappers + repeated metric header/value blocks.
- Severity: high
- Recommended consolidation target:
  - Introduce `src/components/ui/Card.tsx` and promote `DataCard` to canonical `MetricCard`.
- Safety notes:
  - Keep route-specific internals; only extract shell first.

### Typography
- Duplicated files/locations:
  - `src/routes/Dashboard.tsx`
  - `src/routes/Tasks.tsx`
  - `src/components/DataCard.tsx`
- What is repeated:
  - Small uppercase metric labels (`text-xs font-medium text-muted-foreground uppercase tracking-wider`) and section headings.
- Severity: medium
- Recommended consolidation target:
  - Shared typography utility classes or tiny typography primitives.
- Safety notes:
  - Keep local semantic tags (`h1`, `h2`, etc.) unchanged.

### Forms
- Duplicated files/locations:
  - `src/components/TaskDetailsContent.tsx`
  - `src/components/PrayerWidget.tsx` (likely unused candidate)
  - Several route-level form sections
- What is repeated:
  - Input/select/textarea class strings and error styling currently reimplemented inline.
- Severity: high
- Recommended consolidation target:
  - Standardize on `Input`, `Select`, `TextArea` from `src/components/ui`.
- Safety notes:
  - Migrate field-by-field in large components with visual QA.

### Layout
- Duplicated files/locations:
  - `src/components/ui/Modal.tsx`
  - `src/components/ui/ConfirmSheet.tsx`
  - `src/components/ui/DetailsSheet.tsx`
- What is repeated:
  - Escape handling, scroll lock, overlay setup, and touch-drag close mechanics.
- Severity: medium
- Recommended consolidation target:
  - Shared internal overlay/sheet primitives while preserving public APIs.
- Safety notes:
  - Mobile UX is sensitive; test iOS/Android gestures after each step.

### Tables/lists
- Duplicated files/locations:
  - `src/routes/Tasks.tsx` list groups
  - `src/routes/Finance.tsx` table/list wrappers
  - `src/routes/Calendar.tsx` list/card wrappers
- What is repeated:
  - Similar row spacing/border/layout blocks.
- Severity: medium
- Recommended consolidation target:
  - Shared list section + row wrappers.
- Safety notes:
  - Do not force generic rows on heavily interactive task rows.

### Data fetching
- Duplicated files/locations:
  - `src/hooks/useTasks.ts`, `useFinance.ts`, `useHabits.ts`, `useHealthData.ts`, `useSleep.ts`, `useProjects.ts`, `useCalendar.ts`, `useInvestments.ts`
- What is repeated:
  - User-scoped queries, mutation invalidate flows, create/update/delete boilerplate.
- Severity: high
- Recommended consolidation target:
  - Shared hook internals for key generation + user-scope + mutation wrappers.
- Safety notes:
  - Preserve query keys and invalidate scope to avoid stale data regressions.

### Supabase access
- Duplicated files/locations:
  - `api/auth/ticktick/token.ts`
  - `api/ticktick/import.ts`
  - `api/ticktick/pull.ts`
  - `api/ticktick/sync.ts`
  - `api/ticktick/disconnect.ts`
- What is repeated:
  - Handler-local `getSupabaseService` and `getUserIdFromRequest` logic.
- Severity: high
- Recommended consolidation target:
  - Replace local copies with imports from `api/lib/supabaseServer.ts`.
- Safety notes:
  - Keep existing status-code/error semantics stable.

### Validation
- Duplicated files/locations:
  - Route forms and API handlers
- What is repeated:
  - Inline required-field checks and method guards.
- Severity: medium
- Recommended consolidation target:
  - Shared lightweight validation helpers at boundary points.
- Safety notes:
  - Introduce incrementally; avoid framework-level migration unless needed.

### Utilities
- Duplicated files/locations:
  - `src/hooks/useTasks.ts`, `src/hooks/useHabits.ts`, `src/hooks/usePrayerHabits.ts`
  - `src/components/PrayerWidget.tsx`, `src/components/PrayerTimesWidget.tsx`, `src/components/CompactPrayerHabit.tsx`
  - `vite.config.ts` dev proxy and `api/proxy.ts`
- What is repeated:
  - `toDateOnly` variants, prayer icon switch logic, proxy fetch policy.
- Severity: medium
- Recommended consolidation target:
  - Centralize date and prayer display helpers; keep environment-specific proxy wrappers thin.
- Safety notes:
  - Preserve current date formatting semantics.

### Hooks
- Duplicated files/locations:
  - Most domain hooks in `src/hooks`
- What is repeated:
  - Similar query/mutation lifecycle and fallback behavior.
- Severity: high
- Recommended consolidation target:
  - Internal shared hook toolkit under `src/hooks/shared`.
- Safety notes:
  - Migrate one domain at a time with regression checks.

### Types
- Duplicated files/locations:
  - TickTick task shape/mapping logic appears both in helper and handler-local code paths
- What is repeated:
  - Type + mapping behavior around TickTick task transformations.
- Severity: medium
- Recommended consolidation target:
  - Single source in `api/lib/ticktick.ts`.
- Safety notes:
  - Validate pull/import/sync endpoints before and after.

## 4. Design System / UI Standardization Opportunities

- Default Button:
  - `src/components/ui/Button.tsx`
- Default Card:
  - Introduce `src/components/ui/Card.tsx` and standardize on it as base wrapper.
  - Use `src/components/DataCard.tsx` as metric-specific extension (after reactivation in routes).
- Default Typography/Text system:
  - Define small set of reusable text roles (page title, section title, metric label, body-muted).

- Font usage inconsistencies:
  - Base font uses `--font-sans` with system fallback in `src/index.css`.
  - Tauri native window applies a different stack (`Segoe UI Variable` path).
  - Selective `font-mono` usage in metric/time blocks is not standardized.

- Variant opportunities:
  - Button: icon/toggle/segmented variants.
  - Card: base/metric/interactive variants.
  - Input: compact and standard variants for sheet-heavy forms.

- Tokenization opportunities:
  - Repeated spacing/radius/border groups can be componentized.
  - Standardize heading/label class tokens.
  - Centralize overlay z-index and spacing conventions.

- Minimum shared UI kit this repo needs:
  - `Button`
  - `Input` / `Select` / `TextArea`
  - `Card` / `MetricCard`
  - `PageHeader` / `SectionLabel`
  - `EmptyState` / `ErrorState` / `Loader`
  - Existing modal/sheet primitives (`Modal`, `ConfirmSheet`, `DetailsSheet`)

## 5. Dead or Likely Unused Code

Do not delete automatically; validate first.

| File path | Why it looks unused | Confidence | Safe validation steps before removal |
|---|---|---|---|
| `src/components/PrayerWidget.tsx` | No import consumers found in `src` (only self-definition match) | high | grep symbol, run build, verify no dynamic import paths, remove in isolated PR |
| `src/components/PrayerHabitSync.tsx` | No import consumers found; component only triggers hook side-effect then returns `null` | high | grep symbol, confirm prayer sync still occurs from active prayer components, remove or replace with explicit hook usage |
| `src/hooks/useWellness.ts` | Exports are not consumed outside the file | high | grep all `useWellness*` references, verify product roadmap, remove in small PR |
| `src/hooks/useShifts.ts` | No consumers found, appears mock-only | high | grep `useShifts`, verify no planned route usage, remove or move to prototype docs |
| `src/hooks/useAcademics.ts` | Wrapper hook with no consumers | high | grep `useAcademics`, ensure no pending import aliases, remove safely |
| `src/components/InBodyTable.tsx` | No consumers found in current route/component imports | medium | grep `InBodyTable`, run route QA for Health, then remove if still unused |

## 6. Refactor Plan

- Phase 1: zero-risk documentation and mapping
  - Document canonical primitives and publish reuse rules.
  - Add import-usage inventory for dead-code candidates.

- Phase 2: introduce shared wrappers/primitives
  - Add `Card` base primitive.
  - Add typography helpers/tokens.
  - Add shared utility helpers (`toDateOnly`, prayer icon map).

- Phase 3: replace duplicates incrementally
  - Migrate one route at a time (start with Dashboard cards).
  - Then migrate `TaskDetailsContent` field controls to existing form primitives.
  - Then consolidate route-level list/card wrappers.

- Phase 4: remove dead code after validation
  - Remove high-confidence unused files one by one with build checks.

- Phase 5: add guardrails to prevent future duplication
  - Add lint/import guardrails and PR checklist.
  - Enforce shared API helper usage in Vercel handlers.

## 7. Guardrails for Future Development

- Reuse existing shared components first.
- No new button/card/text component unless an existing primitive cannot be extended.
- Centralize Supabase access patterns:
  - Frontend: shared hook patterns + centralized client.
  - Backend: `api/lib/supabaseServer.ts` only for auth/client bootstrap.
- Centralize shared types and validation.
- Prefer composition over duplication.
- Keep changes incremental and behavior-preserving.
- Require explicit rationale in PRs when introducing new UI primitives.

## 8. Suggested File/Folder Structure Improvements

Realistic incremental improvements based on current layout:

- Add `src/components/ui/Card.tsx`.
- Add `src/components/ui/Typography.tsx` (or utility class exports) for repeated text roles.
- Add `src/lib/date.ts` or extend `src/lib/utils.ts` for date-only helpers used across hooks.
- Add `src/lib/prayer.ts` for shared prayer display helpers (icon mapping/time labels).
- Add `src/hooks/shared/` for reusable query-key and user-scoped data helpers.
- Keep domain hooks/routes in place; deduplicate internals first.
- Update `api/ticktick/*` handlers to consume `api/lib/supabaseServer.ts` and `api/lib/ticktick.ts` consistently.

---

### Reuse-first coding policy (effective now)
- Prefer existing shared primitives/modules before creating new ones.
- Only create new abstractions when existing primitives cannot be safely extended.
- Keep refactors small, staged, and behavior-preserving.

### Highest-priority consolidations (short list)
- Standardize Card usage (`Card` + `MetricCard`) in route dashboards.
- Eliminate repeated server auth/bootstrap code in API handlers.
- Start deduplicating hook CRUD/query patterns with shared internals.

### Top canonical shared components to standardize on
- `src/components/ui/Button.tsx`
- `src/components/ui/Input.tsx` exports (`Input`, `Select`, `TextArea`)
- `src/components/ui/Modal.tsx`
- `src/components/ui/ConfirmSheet.tsx`
- `src/components/ui/DetailsSheet.tsx`
- `src/components/ui/Card.tsx` (to be introduced as canonical base)

### Safest next refactor to implement first
- Implement `src/components/ui/Card.tsx` and migrate one isolated section (Dashboard quick stats cards) to it without changing behavior, data logic, or interaction semantics.
