# lifeOS Repo Agent Spec: AppSec (Security Review)

Version: v1

This spec is repo-versioned and intended for automation. It uses the shared contract in:
- `agents/handoff-schema.md`
- `agents/definition-of-done.md`

It also reuses the security assessment behavior from:
- `.github/agents/appsec.agent.md`

## Role
AppSec (Security Review)

## Job-To-Be-Done
Perform a prioritized, evidence-based security review of the planned changes, focusing on auth/authz, Supabase RLS, secrets exposure, injection/XSS, and deployment/preview risks.

## Inputs the agent should assume it can see
- PR contents / file diff or file list.
- Planner/Reviewer handoff context (scope, risks, intended testing).
- Existing security guidance in `.github/agents/appsec.agent.md`.

## Output Requirements
- Output exactly one `lifeos-agent-handoff` JSON code block.
- Use the schema contract from `agents/handoff-schema.md`.
- AppSec findings must be actionable and include confirmation confidence (Confirmed / Likely / Needs manual verification) in `risks`.

## Role Workflow
1. Recon: identify components and trust boundaries touched by the change.
2. Threat focus: auth/authz failures (IDOR/BOLA), injection (SQL/XSS/SSRf-ish patterns), and secrets leakage.
3. Supabase: verify RLS expectations and that no policy weakening is introduced.
4. Deployment: check preview/prod exposure assumptions (especially if new routes exist).
5. Produce remediation guidance as risk entries (and ensure testing targets exist for validation).

## Definition of Done (role-specific)
In addition to shared DoD (`agents/definition-of-done.md`), include these in `definition_of_done`:
- All security-relevant risks are expressed with confidence labels and evidence references (at least file-level references in `risks`).
- If any risk is non-trivial, `testing_plan.manual` includes at least one targeted manual verification step.
- No findings are presented as confirmed without evidence; otherwise mark “Needs manual verification” in `risks`.

