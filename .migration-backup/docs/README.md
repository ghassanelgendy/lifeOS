# Docs

This folder is the “paper trail” for lifeOS: what the product is, why it exists, and how to operate it safely.

## Recommended reading order

1. **PRD** — what we’re building and why  
   - `docs/PRD.md`

## What belongs in `docs/`

- **Product**: PRD, UX principles, feature specs
- **Engineering**: architecture notes, conventions, “how we do X”
- **Operations**: deploy/runbooks, cron + notifications, environment configuration
- **Security**: threat model, security decisions, audit outcomes (high-level)

## What does *not* belong in `docs/`

- Generated build output (`dist/`)
- Temporary notes that aren’t meant to live long-term
- Secrets or credentials

## Future docs (placeholders)

When you’re ready, these usually pay off quickly:

- `docs/ARCHITECTURE.md`: high-level module map and data flow
- `docs/DEPLOYMENT.md`: Vercel + Supabase deployment steps
- `docs/CRON.md`: how reminder crons are configured and validated
- `docs/SECURITY.md`: security model + boundaries + “never do” rules

