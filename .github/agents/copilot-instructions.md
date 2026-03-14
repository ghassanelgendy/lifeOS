# Repository Copilot Instructions

You are working in a TypeScript + React + Vite + Node.js + Vercel + Supabase codebase.

## Core engineering principles
- Follow DRY, SOLID, KISS, separation of concerns, and secure-by-default engineering.
- Preserve existing behavior unless the task explicitly asks for behavior changes.
- Prefer incremental, low-risk refactors over large rewrites.
- Reuse existing components, hooks, utils, schemas, services, and types before creating new ones.
- Prefer composition over duplication.
- Do not add abstractions unless they clearly reduce repetition, improve maintainability, or strengthen consistency/security.
- Match the repository’s current architecture, conventions, and design language.
- Optimize for maintainability, consistency, usability, and safety.

## Reuse-first policy
Before creating any new component, hook, utility, type, service, or pattern:
1. Search the repo for an existing equivalent or near-equivalent implementation.
2. Reuse it if it fits.
3. Extend it if the change is small, safe, and consistent with the current system.
4. Only create a new abstraction if no suitable one exists.

## Strict design-system consistency
- Do not introduce a new visual style when an existing one already exists in the repository.
- Do not create a new Button style, Card style, Text style, Heading style, Input style, Modal style, Badge style, Table style, Layout style, or similar primitive if an existing shared one can be reused or extended.
- Even when the user asks for a very specific UI style, first adapt that request to the existing design system and visual language of the repo.
- Prefer matching the current product style over inventing a new one-off style.
- New UI must look native to the existing application, not like a separate product.
- Prefer variants, composition, and token reuse over creating parallel visual systems.
- Do not create “almost-the-same” duplicate components for styling differences that can be handled by variants or props.
- Reduce repeated className blocks by extracting common primitives only when safe and clearly beneficial.
- Keep presentational components focused, lightweight, and consistent.

## UX and usability standards
- Favor studied UX patterns that are easy to use, familiar, accessible, and visually clean.
- Prioritize clarity, hierarchy, readability, spacing, feedback states, and predictable interactions.
- Prefer simple and intuitive flows over flashy or overly custom UI.
- Use established patterns from the existing product unless there is a strong reason to change them.
- Keep interfaces beautiful through consistency, alignment, spacing, typography discipline, and restrained visual choices.
- Avoid adding visual complexity that does not improve usability.
- Respect accessibility, keyboard navigation, focus states, contrast, and sensible semantics.

## Typography and styling
- Keep typography usage consistent across the app.
- Reuse existing text primitives, heading styles, font patterns, spacing patterns, and design tokens.
- Avoid ad hoc font usage or one-off typography wrappers unless justified.
- Reuse existing color tokens, spacing scales, radii, shadows, layout helpers, and style utilities where available.
- Do not introduce new typography systems or competing style conventions unless explicitly required and justified by the codebase.

## Hooks and utilities
- Do not duplicate hook logic.
- Do not duplicate formatting, parsing, mapping, filtering, transformation, or validation helpers.
- Consolidate repeated utilities where practical.
- Keep utilities pure when possible.
- Keep hooks focused on a single clear concern.
- Prefer existing helper functions and shared hooks before adding new ones.

## Types and validation
- Prefer shared types/interfaces over repeating similar shapes.
- Centralize shared domain types when practical.
- Avoid redefining the same request/response/data shape in multiple places.
- Reuse existing validation schemas when possible.
- Keep validation close to trust boundaries and shared where reused.

## Supabase and data access
- Avoid duplicating Supabase query logic across components.
- Prefer shared data access helpers/services for repeated queries and mutations.
- Keep auth, session, profile, and database access patterns consistent.
- Do not scatter environment-specific logic unnecessarily.
- Centralize repeated query/mutation patterns when it improves safety and maintainability.
- Favor least-privilege data access and existing repository patterns.

## Security layer
- Treat security as a default requirement, not an optional enhancement.
- Preserve or improve the current security posture with every change.
- Never weaken authentication, authorization, validation, or data protection for convenience.
- Follow least privilege for all services, database access, API keys, and roles.
- Prefer secure-by-default implementations.

### Secrets and environment variables
- Never hardcode secrets, API keys, tokens, database credentials, or Supabase service-role keys.
- Only use environment variables for sensitive values.
- Never expose server-only secrets to client-side code.
- Clearly separate public env variables from server-only env variables.
- Do not log secrets or include them in error messages.

### Authentication and authorization
- Do not bypass auth checks, role checks, or permission boundaries.
- Enforce authorization on the server side, not only in the UI.
- Treat client-side guards as UX only, never as security controls.
- Reuse existing auth helpers and permission patterns before adding new ones.
- If a route, action, or query touches user data, verify who is allowed to access or mutate it.

### Supabase security
- Respect Row Level Security (RLS) and do not suggest disabling it unless explicitly required and justified.
- Prefer RLS-compliant queries and policies over app-side filtering.
- Use the anon key only where appropriate and keep service-role usage strictly server-side.
- Centralize Supabase access patterns when possible to reduce mistakes.
- For schema or policy changes, favor least-privilege access and document the security impact.

### Input validation and data handling
- Validate all external input at trust boundaries.
- Sanitize and validate request payloads, query params, form data, headers, and uploaded content where relevant.
- Reuse shared schemas and validators instead of duplicating validation logic.
- Never trust client-provided identifiers, roles, prices, flags, or ownership fields without server verification.
- Encode or sanitize user-generated content before rendering when needed to reduce XSS risk.

### API and backend safety
- Protect sensitive endpoints against unauthorized access.
- Avoid insecure direct object references by verifying ownership and access rights.
- Do not expose internal implementation details unnecessarily in API responses.
- Use safe error handling: helpful for developers, minimal for attackers.
- Prefer idempotent and explicit mutation flows where practical.

### Frontend security
- Do not store sensitive secrets in localStorage, sessionStorage, or client bundles.
- Be cautious with dangerouslySetInnerHTML and raw HTML rendering.
- Avoid introducing XSS, CSRF, token leakage, open redirect, or clickjacking risks.
- Keep client code free of privileged logic that belongs on the server.

### Dependencies and unsafe code
- Avoid adding dependencies unless necessary and reputable.
- Prefer maintained, widely trusted packages.
- Flag outdated, vulnerable, or unnecessary dependencies.
- Do not use eval, unsafe dynamic execution, or risky deserialization unless absolutely necessary and clearly justified.

### Logging and observability
- Log security-relevant failures carefully without leaking secrets or personal data.
- Keep logs useful for debugging but minimal in sensitive data exposure.
- Redact tokens, passwords, secrets, personal identifiers, and protected payload fields where appropriate.

### File uploads and external content
- Treat uploaded files and third-party content as untrusted.
- Validate file type, size, and handling path before processing.
- Do not assume MIME type alone is trustworthy.
- Avoid exposing uploaded content in unsafe ways.

## Refactoring safety
- Do not mass-edit the codebase without understanding call sites.
- Before removing code, check references/imports/usages carefully.
- Treat likely-unused code as suspicious, not automatically safe to remove.
- When in doubt, document candidates for removal instead of deleting them immediately.
- Keep refactors phased, reversible, and easy to validate.
- Avoid unnecessary renames, moves, or rewrites that increase risk without strong payoff.

## Dead code and cleanup
- Identify likely-unused files, imports, utilities, types, hooks, routes, and components carefully.
- Confirm usage before deletion.
- Prefer documenting removal candidates first when confidence is not high.
- Remove unused imports, branches, variables, and stale helpers when safe.
- Do not keep dead abstractions, duplicate wrappers, or speculative code.

## Implementation style
- Match the repository’s naming conventions and structure.
- Keep code readable, explicit, and maintainable.
- Keep imports clean.
- Avoid unused variables, imports, dead branches, and speculative abstractions.
- Add concise comments only where they add real value.
- Avoid overengineering.
- Prefer the smallest safe implementation that fits the current architecture.
- Keep public APIs of shared components stable unless changes are explicitly required.

## Response format for coding tasks
When helping with a coding task:
1. Mention existing reusable files/components found.
2. State whether you will reuse, extend, refactor, or create new.
3. Choose the smallest safe implementation.
4. Call out any duplication, dead-code, UX, consistency, or security concerns separately.

## Response format for review/audit tasks
For audits and reviews:
- Identify repeated patterns.
- Identify canonical shared abstractions.
- Identify likely dead code.
- Identify inconsistent UI primitives or styling drift.
- Identify security risks and trust-boundary issues.
- Suggest phased, reversible refactors.
- Prioritize high-impact, low-risk cleanup first.

## Security review behavior
When making or reviewing changes:
1. Check auth and permission impact.
2. Check secret handling.
3. Check input validation and output rendering.
4. Check Supabase/RLS implications.
5. Check whether the change increases attack surface.
6. Mention security risks, even if they are out of scope for the current task.

## Security-first response rule
When helping with implementation:
- Prefer the most secure approach that fits the current architecture.
- If a faster approach is less secure, explicitly say so and prefer the safer one.
- Call out tradeoffs clearly when security, speed, and complexity conflict.

## Final operating rule
- Reuse what already exists.
- Match the current design system.
- Do not invent a new style when the repo already has one.
- Keep the UI beautiful by keeping it consistent.
- Keep the UX easy by using proven patterns.
- Keep the code safe, clean, DRY, and maintainable.
- When user instructions conflict with the repository’s design consistency, prefer implementing the intent using the existing component system rather than introducing a new visual style.