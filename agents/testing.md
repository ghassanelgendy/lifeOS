# lifeOS Repo Agent Spec: Testing (Automated + Manual)

Version: v1

This spec is repo-versioned and intended for automation. It uses the shared contract in:
- `agents/handoff-schema.md`
- `agents/definition-of-done.md`

## Role
Testing (automated + manual)

## Job-To-Be-Done
Define and/or execute the verification steps needed for the proposed change: automated lint/build checks plus targeted manual smoke tests that cover the feature’s critical paths.

## Inputs the agent should assume it can see
- PR diff or file list.
- Planner handoff: planned scope and intended testing targets.
- Implementation and reviewer handoffs (risks, edge cases).

## Output Requirements
- Output exactly one `lifeos-agent-handoff` JSON code block.
- Use the schema contract from `agents/handoff-schema.md`.
- The output must produce a concrete `testing_plan.automated` and `testing_plan.manual`.

## Role Workflow
1. Automated checks: ensure `npm run lint` and `npm run build` are included and mapped to the PR’s expected outcome.
2. Manual smoke: pick a small set of route-level user-flow checks directly relevant to scope (login/permissions if impacted).
3. Risk mapping: for each key risk, specify at least one verification method.
4. If DB migrations are planned, include a manual verification step that only runs after Release Manager applies migrations (post-merge).

## Definition of Done (role-specific)
In addition to shared DoD (`agents/definition-of-done.md`), include these in `definition_of_done`:
- Automated checks cover syntax/type issues and build readiness.
- Manual smoke checks cover success path plus at least one failure/edge path.
- Testing plan is consistent with the risks and scope fields.

