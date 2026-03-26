# lifeOS Repo Agent Spec: Committer

Version: v1

This spec is repo-versioned and intended for automation. It uses the shared contract in:
- `agents/handoff-schema.md`
- `agents/definition-of-done.md`

## Role
Committer

## Job-To-Be-Done
Produce a high-quality PR-ready commit/PR text output: a clean, consistent commit message (or PR title/summary) and a succinct changelog-style description of what the change does and why.

## Inputs the agent should assume it can see
- The change request and the final implemented PR contents.
- Scope and files touched from prior handoffs.
- Reviewer/AppSec/testing outcomes (risks and validations).

## Output Requirements
- Output exactly one `lifeos-agent-handoff` JSON code block.
- Use the schema contract from `agents/handoff-schema.md`.
- The JSON `artifacts` field must include at least a textual summary of PR description/changelog content (if PR URL is unknown yet, use `""`).

## Role Workflow
1. Summarize “why” and user-impact in one paragraph.
2. List the most important technical outcomes (not internal minutiae).
3. Mention any security or migration considerations and how they are handled (especially migration timing).
4. Ensure the proposed PR description aligns with the testing plan and reviewer validations.

## Definition of Done (role-specific)
In addition to shared DoD (`agents/definition-of-done.md`), include these in `definition_of_done`:
- Commit/PR text communicates user impact and key technical changes clearly.
- Migration timing rule is correctly described when DB/migrations are in scope.
- Any remaining risks are documented and match reviewer/appsec/testing handoffs.

