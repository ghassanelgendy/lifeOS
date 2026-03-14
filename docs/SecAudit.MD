# lifeOS Full-Scale Security Audit Report

Date: 2026-03-13 
Repository: lifeOS 
Branch: tauri 
Scope: Full repository assessment (SAST, AuthN/AuthZ, Supabase, Vercel, dependency/SCA, secrets, DAST plan)

## Executive Summary

Overall security posture is mixed: strong RLS hardening and several secure implementation patterns are present, but there are multiple high-impact backend trust-boundary flaws that can enable cross-tenant abuse or infrastructure probing.

Top 3 most critical risks:
1. Unauthenticated SSRF-capable proxy endpoint in [api/proxy.ts](api/proxy.ts#L7)
2. Cross-user write exposure in upload edge functions due to trusted request-body user_id in [supabase/functions/upload-sleep/index.ts](supabase/functions/upload-sleep/index.ts#L155) and [supabase/functions/upload-screentime/index.ts](supabase/functions/upload-screentime/index.ts#L617)
3. Public anon key accepted as trusted authorization path in sync-reminders in [supabase/functions/sync-reminders/index.ts](supabase/functions/sync-reminders/index.ts#L200)

Production-readiness verdict from a security perspective: not ready for broad production exposure until High findings are remediated.

## Architecture & Attack Surface

Key components:
- Frontend: Vite + React app in src
- Server APIs: Vercel functions in api
- Database/Auth: Supabase Postgres + Auth + RLS
- Edge compute: Supabase edge functions in supabase/functions
- Integrations: TickTick OAuth/API, Web Push, iOS Shortcuts

Trust boundaries:
- Browser/client state vs serverless trusted operations
- Authenticated user context vs service-role privileged writes
- Public environment values (VITE_*) vs server-only secrets
- Cron/internal automation callers vs public invocations

High-risk entry points:
- /api/proxy URL fetch
- upload-sleep and upload-screentime edge functions
- sync-reminders edge function auth path
- cron and reminder dispatch functions with environment-dependent auth behavior

## Findings Table

| ID | Title | Severity | Confidence | Category | Affected Component | Evidence | Why it matters | Safe reproduction summary | Remediation | References |
|----|-------|----------|------------|----------|--------------------|----------|----------------|---------------------------|------------|------------|
| SEC-01 | Unauthenticated SSRF in proxy route | High | High | SSRF | Vercel API route | Accepts arbitrary http/https target in [api/proxy.ts](api/proxy.ts#L7) | Enables server-side request abuse to internal/metadata targets | Call /api/proxy with controlled URL and observe proxied response | Add auth, allowlist domains, block private/link-local hosts | [api/proxy.ts](api/proxy.ts#L1) |
| SEC-02 | Cross-user write risk in upload-sleep | High | High | AuthZ / IDOR | Supabase edge function | Body user_id accepted and only format-validated in [supabase/functions/upload-sleep/index.ts](supabase/functions/upload-sleep/index.ts#L155) | Authenticated attacker may submit data for another user UUID | Invoke function with valid token and different user_id in body | Bind writes to JWT subject; ignore client user_id | [supabase/functions/upload-sleep/index.ts](supabase/functions/upload-sleep/index.ts#L155) |
| SEC-03 | Cross-user write risk in upload-screentime | High | High | AuthZ / IDOR | Supabase edge function | Same trust pattern at [supabase/functions/upload-screentime/index.ts](supabase/functions/upload-screentime/index.ts#L617) | Allows data poisoning across tenants | Same pattern as SEC-02 | Same remediation as SEC-02 | [supabase/functions/upload-screentime/index.ts](supabase/functions/upload-screentime/index.ts#L617) |
| SEC-04 | Anon key treated as trusted auth | High | High | Broken access control | sync-reminders edge function | isProjectKey accepts anon key in [supabase/functions/sync-reminders/index.ts](supabase/functions/sync-reminders/index.ts#L200) | Anon key is public by design; cannot act as secret auth | Use anon key path with arbitrary user_id branch | Remove anon key privileged path, require user JWT match or dedicated secret | [supabase/functions/sync-reminders/index.ts](supabase/functions/sync-reminders/index.ts#L200) |
| SEC-05 | OAuth state not verified in callback | Medium | High | OAuth/CSRF | TickTick callback flow | state read but not compared in [src/routes/AuthTickTickCallback.tsx](src/routes/AuthTickTickCallback.tsx#L11) | Weakens CSRF/session integrity in OAuth callback handling | Replay callback with mismatched state and observe behavior | Validate state against stored value and reject mismatch | [src/routes/AuthTickTickCallback.tsx](src/routes/AuthTickTickCallback.tsx#L11) |
| SEC-06 | Cron auth is optional based on env presence | Medium | High | Misconfiguration/AuthZ | cron route | Check only enforced if CRON_SECRET exists in [api/cron/send-task-reminders.ts](api/cron/send-task-reminders.ts#L10) | Fail-open risk when secret missing | Run endpoint without Authorization in misconfigured env | Fail closed when CRON_SECRET missing | [api/cron/send-task-reminders.ts](api/cron/send-task-reminders.ts#L10) |
| SEC-07 | prayer-notifications-dispatch may be open on secret misconfiguration | Medium | Medium | Misconfiguration | Edge function | verify_jwt false + runtime secret logic in [supabase/functions/prayer-notifications-dispatch/index.ts](supabase/functions/prayer-notifications-dispatch/index.ts#L82) | Misconfiguration can expose push trigger path | Omit secrets and test invocation behavior | Enforce mandatory secret presence and fail hard | [supabase/functions/prayer-notifications-dispatch/index.ts](supabase/functions/prayer-notifications-dispatch/index.ts#L82) |
| SEC-08 | Missing security headers in deployment config | Medium | High | Hardening | Vercel deployment | No security headers block in [vercel.json](vercel.json#L1) | Increases browser-side attack surface and policy bypass risk | Inspect response headers on deployed app | Add CSP, HSTS, XFO, XCTO, RP, PP headers | [vercel.json](vercel.json#L1) |
| SEC-09 | Reminder function callable by any authenticated user | Low | Medium | Abuse potential | send-task-reminders edge function | No explicit role/secret gate in [supabase/functions/send-task-reminders/index.ts](supabase/functions/send-task-reminders/index.ts#L48) | Potential spam/DoS trigger path | Invoke repeatedly with valid auth | Require cron/service secret and throttle | [supabase/functions/send-task-reminders/index.ts](supabase/functions/send-task-reminders/index.ts#L48) |
| SEC-10 | Push subscription claim policy race risk | Low | Medium | RLS policy design | push_subscriptions policy | Null-owner claim policy in [supabase/migrations/20260221000013_push_subscriptions_claim_policy.sql](supabase/migrations/20260221000013_push_subscriptions_claim_policy.sql#L1) | Possible subscription ownership takeover race | Attempt claim during ownership transition | Tighten claim constraints and add nonce/device binding | [supabase/migrations/20260221000013_push_subscriptions_claim_policy.sql](supabase/migrations/20260221000013_push_subscriptions_claim_policy.sql#L1) |
| SEC-11 | Detailed upstream errors returned to clients | Low | High | Information disclosure | TickTick token route | Detailed error passthrough in [api/auth/ticktick/token.ts](api/auth/ticktick/token.ts#L80) | Exposes internals for attacker recon | Trigger upstream failure and inspect response body | Return generic client error; keep details server logs only | [api/auth/ticktick/token.ts](api/auth/ticktick/token.ts#L80) |
| SEC-12 | Destructive SQL helper in migrations tree | Low | High | Operational safety | SQL scripts | Bulk delete script exists in [supabase/migrations/delete_all_data.sql](supabase/migrations/delete_all_data.sql#L1) | Accidental execution risk | Enumerate migration tooling behavior | Move destructive scripts outside migrations path | [supabase/migrations/delete_all_data.sql](supabase/migrations/delete_all_data.sql#L1) |

## Detailed Findings

### SEC-01 Unauthenticated SSRF in Proxy Endpoint
- Classification: Confirmed vulnerability
- Description: Route accepts arbitrary URL and fetches server-side without auth or allowlist.
- Technical evidence: [api/proxy.ts](api/proxy.ts#L7)
- Impact scenario: Internal endpoint/metadata probing and data relay through backend.
- Preconditions: Publicly reachable API route.
- Remediation steps:
1. Require authenticated caller.
2. Allowlist trusted calendar hosts only.
3. Reject private, loopback, link-local, and local hostnames/IP ranges.
4. Enforce timeout and max response size.
- Secure code example:

```ts
const u = new URL(inputUrl);
if (!allowedHosts.has(u.hostname)) throw new Error('forbidden host');
if (isPrivateHost(u.hostname)) throw new Error('forbidden target');
```

- Manual verification:
1. Try localhost/private targets and verify 403.
2. Verify only allowlisted hosts pass.

### SEC-02 Cross-User Write in upload-sleep
- Classification: Confirmed vulnerability
- Technical evidence: [supabase/functions/upload-sleep/index.ts](supabase/functions/upload-sleep/index.ts#L155)
- Impact scenario: Authenticated attacker can write records under another user UUID.
- Preconditions: Valid accepted token and knowledge/guess of target UUID.
- Remediation steps:
1. Validate JWT and resolve user identity server-side.
2. Override incoming user_id with JWT subject.
3. Reject mismatch.
- Manual verification: Attempt writes with mismatched user_id should fail 403.

### SEC-03 Cross-User Write in upload-screentime
- Classification: Confirmed vulnerability
- Technical evidence: [supabase/functions/upload-screentime/index.ts](supabase/functions/upload-screentime/index.ts#L617)
- Impact scenario/preconditions/remediation: Same as SEC-02.

### SEC-04 Anon Key as Trusted Auth in sync-reminders
- Classification: Confirmed vulnerability
- Technical evidence: [supabase/functions/sync-reminders/index.ts](supabase/functions/sync-reminders/index.ts#L200)
- Impact scenario: Public anon key can satisfy privileged branch and undermine tenant isolation.
- Preconditions: Anon key exposure (expected in browser config).
- Remediation:
1. Remove anon-key privileged branch.
2. Allow only verified user JWT matching user_id or dedicated internal secret path.
3. Audit historical writes.

### SEC-05 Missing OAuth state validation
- Classification: Likely weakness
- Technical evidence: [src/routes/AuthTickTickCallback.tsx](src/routes/AuthTickTickCallback.tsx#L11)
- Impact scenario: OAuth session mix-up/CSRF risk.
- Remediation:
1. Compare callback state with stored state.
2. Abort flow on mismatch.
3. Clear transient auth state values after use.

### SEC-06 Cron route fail-open on missing CRON_SECRET
- Classification: Likely weakness
- Technical evidence: [api/cron/send-task-reminders.ts](api/cron/send-task-reminders.ts#L10)
- Impact scenario: In misconfigured environments, endpoint can be triggered publicly.
- Remediation:
1. Enforce fail-closed startup/runtime checks when secret absent.
2. Add alerting for missing secrets.

### SEC-07 prayer-notifications-dispatch secret-config dependence
- Classification: Needs manual verification
- Technical evidence: [supabase/functions/prayer-notifications-dispatch/index.ts](supabase/functions/prayer-notifications-dispatch/index.ts#L82)
- Impact scenario: Incorrect secrets can expose invocation path.
- Remediation:
1. Make secret mandatory and validated at function start.
2. Add rate limiting and invocation logs.

### SEC-08 Missing Security Headers
- Classification: Risky pattern
- Technical evidence: [vercel.json](vercel.json#L1)
- Impact scenario: Weak browser hardening (clickjacking, MIME sniffing, weaker XSS containment).
- Remediation:
1. Add CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy.
2. Start with report-only CSP in rollout.

### SEC-09 Reminder Trigger Abuse Potential
- Classification: Needs manual verification
- Technical evidence: [supabase/functions/send-task-reminders/index.ts](supabase/functions/send-task-reminders/index.ts#L48)
- Impact scenario: Authenticated users can potentially abuse invocation frequency.
- Remediation:
1. Restrict to trusted caller path.
2. Add per-caller and global throttling.

### SEC-10 Push Subscription Claim Race
- Classification: Needs manual verification
- Technical evidence: [supabase/migrations/20260221000013_push_subscriptions_claim_policy.sql](supabase/migrations/20260221000013_push_subscriptions_claim_policy.sql#L1)
- Impact scenario: Potential race to claim unowned subscription rows.
- Remediation:
1. Add stronger claim conditions.
2. Bind with ephemeral claim token/device proof.

### SEC-11 Error Detail Leakage
- Classification: Risky pattern
- Technical evidence: [api/auth/ticktick/token.ts](api/auth/ticktick/token.ts#L80)
- Impact scenario: Error details may aid attacker recon.
- Remediation: Return generic error payloads to clients.

### SEC-12 Destructive SQL in Migration Directory
- Classification: Risky pattern
- Technical evidence: [supabase/migrations/delete_all_data.sql](supabase/migrations/delete_all_data.sql#L1)
- Impact scenario: Accidental destructive execution.
- Remediation: Move to admin-only scripts path outside migration chain.

## Supabase-Specific Review

RLS status:
- Positive: Multiple hardening migrations indicate strong user-scoped policy intent and cleanup of insecure legacy policies.
- Evidence: [supabase/migrations/20250220000001_fix_all_rls_comprehensive.sql](supabase/migrations/20250220000001_fix_all_rls_comprehensive.sql#L1), [supabase/migrations/20250220000004_remove_insecure_policies.sql](supabase/migrations/20250220000004_remove_insecure_policies.sql#L1)

Policy weaknesses:
- push_subscriptions claim policy warrants hardening review (SEC-10).

Key handling:
- service role appears server-side only in reviewed files.
- anon key is public by design and should never be treated as privileged secret (SEC-04).

Storage security:
- No critical bucket policy exposure confirmed in reviewed repository files.

Edge function risks:
- Auth models are mixed (verify_jwt true/false + custom headers), which increases configuration drift risk.

Auth model issues:
- upload functions trust body user_id instead of bound identity (SEC-02/03).

## Vercel / Deployment Review

Env separation:
- Good baseline separation pattern exists between client and server env names.

Public env exposure:
- No confirmed service role leakage in client code paths reviewed.

Headers:
- Missing hardened response headers in deployment config (SEC-08).

CORS:
- Several edge functions use wildcard origins; validate each endpoint for least-privilege origin policy.

Preview/production concerns:
- Ensure privileged secrets are scoped appropriately across environments.

Caching/CDN concerns:
- Proxy cache behavior should be reviewed for sensitivity and cache key safety.

## Dependency / Supply Chain Review

Key observations:
- npm audit output reported 13 vulnerabilities total (9 high, 4 moderate).
- Notable chains involve server/tooling packages, including @vercel/node transitive advisories.
- No dangerous postinstall/prepare scripts were identified in [package.json](package.json#L1).

Recommended actions:
1. Upgrade vulnerable dependency roots and transitive chains.
2. Re-run audit until high-severity issues are eliminated or explicitly accepted with risk sign-off.
3. Enforce CI security gate for dependency severity threshold.

## DAST Checklist

Prioritized runtime tests:
1. SSRF tests for proxy route with localhost/private/link-local targets.
2. Cross-user write tests for upload-sleep/upload-screentime (mismatched token user vs body user_id).
3. sync-reminders tests using anon key path and arbitrary user_id.
4. Cron invocation tests without secret to verify fail-closed behavior.
5. OAuth callback state mismatch handling.
6. Security header presence checks in deployed responses.

URLs/routes/APIs to test:
- /api/proxy
- /api/cron/send-task-reminders
- /functions/v1/upload-sleep
- /functions/v1/upload-screentime
- /functions/v1/sync-reminders
- /functions/v1/prayer-notifications-dispatch

Expected secure behavior:
- No cross-tenant access with forged identifiers
- No backend fetch to disallowed network targets
- Strict caller authentication for automation endpoints
- Hardened browser security headers on app responses

## Remediation Roadmap

Immediate (today):
1. Fix SSRF controls and authentication on proxy route (SEC-01).
2. Enforce identity binding for upload-sleep/upload-screentime (SEC-02/03).
3. Remove anon-key privileged auth branch in sync-reminders (SEC-04).

Short-term (this week):
1. Add OAuth state verification (SEC-05).
2. Make cron/reminder auth fail-closed under missing secret conditions (SEC-06/07).
3. Add deployment security headers in Vercel config (SEC-08).
4. Reduce client-facing error detail leakage (SEC-11).

Medium-term (this sprint):
1. Resolve dependency advisories and add CI gating.
2. Harden push subscription claim policy (SEC-10).
3. Relocate destructive SQL helper scripts out of migration path (SEC-12).
4. Add regression tests for auth boundary and multi-tenant isolation paths.

## Final Verdict

Major blockers:
- SSRF in proxy endpoint
- Cross-user write vulnerabilities in upload edge functions
- Public anon-key trust path in sync-reminders

Must be fixed before production:
- SEC-01 through SEC-04

Needs manual pentest validation:
- Edge-function auth behavior under real deployment settings
- Subscription claim race feasibility
- Abuse potential for reminder dispatch invocation patterns

