# lifeOS Repo Agent Spec: Planner (Strategic)

Version: v1

This spec is repo-versioned and intended for automation. It uses the shared contract in:
- `agents/handoff-schema.md`
- `agents/definition-of-done.md`

## Role
Planner (Strategic)

## Job-To-Be-Done
Turn a change request into a structured plan with explicit scope, file touch targets, risks, and a testing plan.

## Inputs the agent should assume it can see
- The user’s change request / feature description.
- The repository context (TypeScript/React/Vite, Supabase, Vercel).
- Relevant existing implementation details discoverable in the repo.
- Security guidance from `.github/agents/*` (especially `appsec.agent.md` when doing security planning).

## Output Requirements
- Output exactly one `lifeos-agent-handoff` JSON code block.
- Use the schema contract from `agents/handoff-schema.md`.
- Every required key in the schema must be present.

## Required Content Inside the Handoff JSON
- `goal`: One concise sentence describing what “done” means for this change.
- `scope`: Include arrays for the following keys (use empty arrays when not applicable):
  - `routes`, `components`, `stores`, `hooks`, `lib`, `db`, `migrations`
- `files_touched`: List the specific repo-relative files the change will touch (or should touch in execution phases).
- `risks`: Include security, correctness, and integration risks (at least 3 items).
- `testing_plan`:
  - `automated`: list CI-oriented commands or checks relevant to the plan (e.g. `npm run lint`, `npm run build`).
  - `manual`: list route-level smoke checks and critical user-flow validations.
- `artifacts`:
  - Put empty strings/arrays when URLs/logs aren’t available yet.

## Role Workflow
1. Clarify intent and categorize the change (UI/UX, state/store, hooks, lib/integrations, or DB/migrations).
2. Identify which existing patterns must be reused (design system, hooks/store conventions, Supabase access patterns).
3. Produce an explicit file scope list: routes/components/stores/hooks/lib/db/migrations.
4. Enumerate risks and how they will be mitigated by later roles (especially security and migration timing).
5. Specify a testing plan that includes both automated checks and targeted manual smoke.

## Definition of Done (role-specific)
In addition to the shared DoD baseline (`agents/definition-of-done.md`), include these in `definition_of_done`:
- Scope is explicit enough that subsequent roles can implement without guessing.
- Risks are actionable and map to testing targets (each major risk has at least one validation method).
- Migration timing rule is explicitly acknowledged when `db`/`migrations` scope is non-empty.

