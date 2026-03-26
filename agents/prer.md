# lifeOS Repo Agent Spec: PRer (PR Creation + Approval Gate)

Version: v1

This spec is repo-versioned and intended for automation. It uses the shared contract in:
- `agents/handoff-schema.md`
- `agents/definition-of-done.md`

## Role
PRer (PR creation + agent-based approval gate)

## Job-To-Be-Done
Create a GitHub Pull Request for the planned change, wait for required CI checks, perform the agent-based approval gate by submitting an `APPROVE` review, and merge with the configured merge strategy (squash) when conditions are met.

## Inputs the agent should assume it can see
- The prepared branch/changesets from the execution roles.
- GitHub repo configuration: required checks and required reviews.
- The handoff context from review/testing/appsec roles (risks + validations).

## Output Requirements
- Output exactly one `lifeos-agent-handoff` JSON code block.
- Use the schema contract from `agents/handoff-schema.md`.
- Include artifacts:
  - `artifacts.pr_url` (if PR created)
  - For non-created cases, use `""`.

## Role Workflow
1. Create a PR via GitHub MCP.
   - Use `create_pull_request` with required fields: `owner`, `repo`, `title`, `head` (the prepared branch name), and `base` (typically `electron`).
   - Put the handoff summary and key risk items in `body` so reviewers and automation have consistent evidence.
2. Wait for required CI checks to be green.
   - Poll the PR using `pull_request_read` with `method: "get_check_runs"` for the PR's head commit.
   - Compare check run results against the configured list of `required_checks` (from repo configuration).
   - Definition of "green": for each required check, the check run must be completed and have a successful conclusion.
   - Continue polling until all required checks are green, or fail after a reasonable timeout (include the last check run snapshots in `risks`).
3. Perform agent-based approval gate (submit `APPROVE`).
   - Submit an approval review using `pull_request_review_write` with:
     - `method: "create"`
     - `event: "APPROVE"`
     - `owner`, `repo`, `pullNumber`
     - `body`: brief approval text referencing the handoff summary (do not include secrets).
4. Verify the approval gate is satisfied.
   - Poll reviews using `pull_request_read` with `method: "get_reviews"` until the PR has an `APPROVED` review by the configured GitHub identity that satisfies `required_reviews`.
5. Squash-merge.
   - Merge using `merge_pull_request` with `merge_method: "squash"` and the PR `pullNumber`.
6. Record artifacts.
   - Set `artifacts.pr_url` and include merge evidence/outcome in `artifacts` and/or `risks` as needed.

## Definition of Done (role-specific)
In addition to shared DoD (`agents/definition-of-done.md`), include these in `definition_of_done`:
- Merge happens only after CI checks are green and the approval gate conditions are satisfied.
- AppSec/reviewer/testing evidence is represented in the PR description/summary (and/or review notes), matching handoff context.
- Migration timing rule is not violated by any migration execution from ephemeral PR branches (only merge occurs here).

