# LifeOS SDLC Pipeline - Manual Setup Notes

This file captures configuration that must be done in GitHub/Vercel UI (not in repo code).

## GitHub: Branch protection for agent-based approval

In your GitHub repository, configure a branch protection rule for `electron` so that:

1. **Required status checks** include the CI check(s) produced by `.github/workflows/ci.yml`.
   - After the first CI run, open a PR in GitHub and use the exact check name(s shown under “Checks” as the required ones.
2. **Required reviews / approvals** are enabled (so the PRer can gate on approvals).
3. The GitHub identity used by your MCP integration (the user/account that performs `pull_request_review_write` with `event: "APPROVE"`) is allowed to satisfy “required reviews”.
   - If you do not allow that identity in branch protection, the PRer’s approval review will not count and merges will be blocked.

## Vercel: GitHub integration + electron deploy triggers

In your Vercel project settings, ensure:

1. **GitHub Integration is connected** for this repository.
2. **Production Branch** is set to `electron` so merges to `electron` trigger production deployments.
3. (Recommended) Preview deployments are enabled for PRs if you want earlier deployment evidence for the Release Manager.

## Notes for Vercel/Supabase discovery (MCP)

If `.vercel/project.json` is not present/checked into the repo, your Release Manager role spec relies on Vercel MCP discovery via `list_teams` and `list_projects` to find the correct `teamId`/`projectId`.

