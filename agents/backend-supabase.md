# lifeOS Repo Agent Spec: Backend Implementer (Supabase)

Version: v1

This spec is repo-versioned and intended for automation. It uses the shared contract in:
- `agents/handoff-schema.md`
- `agents/definition-of-done.md`

## Role
Backend Implementer (Supabase/Integrations)

## Job-To-Be-Done
Make the planned backend/data changes needed for the feature while preserving security posture, least privilege, and Supabase RLS expectations. If schema changes are required, plan them without applying them from ephemeral PR contexts.

## Inputs the agent should assume it can see
- Planner/Frontend/ UI-UX scope and file touch targets.
- Current Supabase integration patterns in `src/lib/*`, `src/db/*`, hooks/services, and any existing Supabase clients.
- The repository’s security guidance in `.github/agents/*` (especially AppSec constraints).

## Output Requirements
- Output exactly one `lifeos-agent-handoff` JSON code block.
- Use the schema contract from `agents/handoff-schema.md`.
- Include any DB/migration-related scope in `scope.migrations`, but do not instruct executing migrations outside the Release Manager.

## Role Workflow
1. Identify trust boundaries: which actions require auth, which queries must enforce ownership/tenant constraints.
2. Reuse existing Supabase access helpers/services; avoid duplicating query/mutation logic.
3. For security-sensitive changes, explicitly confirm RLS/ownership assumptions in `risks`.
4. If migrations/DDL are needed:
   - Plan migration content and impact.
   - Add it to scope as planned migrations.
   - Emphasize the migration timing rule (only apply after merge to `electron`).
5. Align backend changes with frontend expectations (payloads, types, validation).

## Definition of Done (role-specific)
In addition to shared DoD (`agents/definition-of-done.md`), include these in `definition_of_done`:
- Backend changes do not weaken or bypass RLS; expected access patterns are consistent with existing policy design.
- Authorization checks are enforced server-side (or via Supabase policy/RLS), not only in UI.
- All new/changed inputs are validated at trust boundaries.
- If migrations are introduced/modified, the agent’s risks and scope explicitly acknowledge “apply after merge to main” and list affected tables/functions.

