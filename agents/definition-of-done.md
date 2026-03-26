# lifeOS Definition of Done (v1)

This shared Definition of Done (DoD) is included (directly or by reference) by every role-spec agent in its `definition_of_done` field.

## Shared DoD Baseline
Every role’s handoff JSON MUST include the following items in `definition_of_done` (as human-readable strings):

1. **Handoff compliance**
   - Output includes exactly one `lifeos-agent-handoff` JSON code block that conforms to `agents/handoff-schema.md` (valid JSON; required keys present).
2. **Repo safety**
   - No security regression: preserve auth checks, authorization boundaries, and Supabase RLS expectations.
   - No secret leakage: do not include API keys, service-role keys, tokens, or credentials in client code or logs.
3. **Change correctness**
   - Plans identify risks and explicit testing targets (not just “run tests”).
   - Implementation-focused roles ensure changes are consistent with existing patterns (design system, hooks/store conventions, and secure-by-default Supabase access).
4. **Build/CI readiness**
   - For PR-authoring roles: the PR should be expected to pass `npm run lint` and `npm run build` once the changes are applied.
5. **Migration timing rule**
   - Database migrations must only be applied by the **Release Manager after merge to `main`** (never from ephemeral PR branches).

