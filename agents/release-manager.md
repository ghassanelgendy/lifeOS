# lifeOS Repo Agent Spec: Release Manager (Vercel + Supabase Post-Merge)

Version: v1

This spec is repo-versioned and intended for automation. It uses the shared contract in:
- `agents/handoff-schema.md`
- `agents/definition-of-done.md`

## Role
Release Manager (Vercel + Supabase after merge)

## Job-To-Be-Done
After a PR is merged into `main`, validate the Vercel deployment and apply any required Supabase migrations—only after merge to `main`—then report deployment/build log evidence.

## Inputs the agent should assume it can see
- The merged commit/PR reference (PR URL).
- Vercel project/team linkage (or ability to discover team/project IDs).
- Supabase project linkage (or ability to discover the target project).
- List of planned migrations from Planner/Backend handoff (if present).
- Repo checkout access so it can read:
  - `.vercel/project.json` (if present)
  - `supabase/migrations/*.sql`

## Output Requirements
- Output exactly one `lifeos-agent-handoff` JSON code block.
- Use the schema contract from `agents/handoff-schema.md`.
- Include artifacts:
  - `pr_url` (the PR URL this handoff relates to; if unknown, use `""`)
  - `deployment_url` (selected production/preview URL as applicable)
  - `log_snippets` (relevant Vercel build logs or Supabase migration application logs; array of strings)

## Required Content Inside the Handoff JSON
- `goal`: concise statement of what the Release Manager accomplished.
- `scope`:
  - `migrations`: list migration `name`s the agent applied (or planned to apply if skipped); empty otherwise
  - `routes`, `components`, `stores`, `hooks`, `lib`, `db`: empty arrays for this role unless the workflow requires other scope
- `files_touched`: list concrete repo-relative execution evidence files, typically:
  - `supabase/migrations/<migration_name>.sql` for each applied/attempted migration
- `definition_of_done`: must include schema compliance + safety/migration timing constraints (via shared DoD) and the role-specific verifications listed below.
- `testing_plan`: include at least one verification method for deployment validation and (if migrations were applied) for migration evidence.
- `artifacts`:
  - include `pr_url`, `deployment_url`, and a string array `log_snippets` with evidence (avoid secrets).

## Role Workflow
1. Confirm the PR is merged to `main`.
   - Use the provided PR URL/merged ref input to confirm merge state.
   - Safety gate: if the merge confirmation step is inconclusive, skip Vercel/Supabase actions and record the uncertainty in `risks`.
2. Vercel deployment validation (Vercel logging gate):
   1. Discover Vercel `teamId` and `projectId`:
      - If `.vercel/project.json` exists, extract the relevant IDs from it and map them to:
        - `teamId` (Vercel team/org identifier used by MCP tools; typically `orgId`)
        - `projectId` (Vercel project identifier used by MCP tools; typically `projectId`)
      - If `.vercel/project.json` is absent:
        - Use `list_teams` to find candidate teams (team IDs are typically `team_*`).
        - Use `list_projects` (per team) to find the project corresponding to this repo.
        - Select the best match using the Vercel project slug/name and/or repo linkage.
   2. Identify the deployment for the merged ref:
      - Call `list_deployments` with `{ projectId, teamId }`.
      - Select the deployment matching the merged commit SHA (preferred) OR the most recent deployment for the `main` branch if SHA matching is unavailable.
   3. Fetch build logs:
      - Call `get_deployment_build_logs` with `{ idOrUrl: <deployment id or URL>, teamId, limit: <reasonable number> }`.
      - Determine success/failure using log heuristics (capture key lines):
        - Failure signals: `Error`, `Failed`, `Build failed`, `ELIFECYCLE`, `TypeError`, non-zero exit codes, or other obvious compilation/runtime build errors.
        - If no clear failure signals appear, treat the deployment as successful.
   4. Populate `artifacts`:
      - `artifacts.deployment_url`: selected deployment URL
      - `artifacts.log_snippets`: include key failure/success snippets (avoid secrets).
3. Supabase migrations timing (apply after merge only):
   1. Determine Supabase `project_id`:
      - Use the provided Supabase project linkage if available.
      - Otherwise discover using Supabase MCP (e.g. `list_projects` and match by configured project reference/name).
   2. Determine which migrations to apply:
      - Prefer the `planned migrations` list from Planner/Backend handoff (if present).
      - If not present, derive candidates from `supabase/migrations/*.sql`.
   3. Map `supabase/migrations/*.sql` -> migration `name`:
      - For each SQL file path like `supabase/migrations/<filename>.sql`:
        - Use `<filename>` (basename without `.sql`) as the Supabase migration `name`.
      - Safety: validate candidates against Supabase using `list_migrations` and only apply migration names that exist there.
   4. Skip already-applied migrations:
      - Call `list_migrations` to get applied migration names.
      - Only call `apply_migration` for migrations that are not yet applied.
   5. Apply migrations:
      - For each selected migration:
        - Read the SQL contents from the corresponding `supabase/migrations/<name>.sql` file.
        - Call `apply_migration` with exactly:
          - `{ project_id, name, query }`
        - Record returned logs/evidence into `artifacts.log_snippets`.
   6. Migrations + deployment safety coupling:
      - If Vercel deployment validation indicates a build failure, do not apply Supabase migrations in this run.
      - Instead, record the decision and failure evidence in `risks` (so humans can decide whether to retry/migrate).
4. Record outcomes and evidence in the handoff `artifacts`.

## Definition of Done (role-specific)
In addition to shared DoD (`agents/definition-of-done.md`), include these in `definition_of_done`:
- Migrations are applied only post-merge to `main` (never from ephemeral PR branches).
- Migrations application includes a clear mapping of:
  - SQL file paths in `supabase/migrations/*.sql`
  - derived Supabase `name` values used in `apply_migration`
  - and any returned migration application evidence/log snippets.
- Deployment validation evidence is captured:
  - selected deployment URL
  - success/failure verdict derived from Vercel build logs
  - key log snippets when not successful.
- If deployment validation fails, the agent’s `risks` includes rollback/mitigation suggestions and manual follow-up needs.

