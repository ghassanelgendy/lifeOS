# Create a GitHub Issue: Writing Gestures for Task Quick Entry

## Title
Writing Gestures: TickTick-style inline syntax for due date, priority, tags, list, assignee, and reminders

## Goal
Let users type natural task text with inline symbols (similar to TickTick) and have lifeOS parse and apply task metadata instantly.

## Scope Hints
- Build parser support for inline task syntax in the task creation flow.
- Apply parsed metadata to task create/update payloads.
- Preserve the existing task flow when no gestures are used.

## UX Notes
- Users should be able to type a single sentence like:
  - `Ask question on Reddit at 6pm #Productivity ~Personal remind me 5 minutes earlier`
- The UI should clearly show parsed values before save (due date/time, tag, list, reminder, etc.).
- If a token is invalid or ambiguous, keep the raw text and show a non-blocking parse hint.
- Parsing should feel immediate and not introduce typing lag.

## Affected Areas
- `src/routes`: task entry surfaces and any quick-add routes
- `src/components`: task input, create/edit sheets, parse-preview UI
- `src/stores`: task draft state and parsed metadata state (if store-backed)
- `supabase/migrations`: only if schema changes are required for reminders/tags/list linkage

## Acceptance Criteria
- Supports inline due date/time with `at` and `*` tokens (e.g., `at 6pm`, `* saturday`).
- Supports `!` for priority assignment.
- Supports `#` for tag assignment.
- Supports `~` for list assignment.
- Supports `@` for member assignment.
- Supports reminder phrases (e.g., `remind me 5 minutes earlier`) and computes correct reminder time.
- Example input:
  - `Ask question on Reddit at 6pm #Productivity ~Personal remind me 5 minutes earlier`
  - Produces task title: `Ask question on Reddit`
  - Due time: `6:00 PM`
  - List: `Personal`
  - Tag: `Productivity`
  - Reminder: `5:55 PM`
- If parsing fails for one token, other valid tokens still apply and the task can still be created.
- Existing manual task creation continues to work without regressions.

## Risks
- Natural language/date parsing edge cases across locales and timezones.
- Conflicts between free-form text and gesture tokens (e.g., emails/usernames containing `@`).
- Reminder computation errors around DST/timezone transitions.
- Performance regressions if parsing runs on every keystroke without safeguards.
- Data integrity risks if parsed values mismatch existing list/tag/member IDs.

## Test Plan
### Automated
- `npm run lint`
- `npm run build`
- Add/extend parser unit tests for:
  - token extraction precedence
  - mixed valid/invalid tokens
  - timezone-aware reminder calculations
  - no-token fallback behavior

### Manual
- Create tasks using each token independently (`at/*`, `!`, `#`, `~`, `@`).
- Create one task using the full combined example and verify all parsed fields.
- Verify parse behavior on mobile task sheet and desktop task modal.
- Verify invalid tokens show hints but do not block task creation.
- Verify reminders trigger at expected local time after save.
