# Docs

This folder is the "paper trail" for lifeOS: what the product is, why it exists, and how to operate it safely.

## Recommended reading order

1. **PRD** — what we're building and why  
   - `docs/PRD.md`
2. **CRON** — how reminder crons are configured and validated  
   - `docs/CRON.md`

## What belongs in `docs/`

- **Product**: PRD, UX principles, feature specs
- **Engineering**: architecture notes, conventions, "how we do X"
- **Operations**: deploy/runbooks, cron + notifications, environment configuration
- **Security**: threat model, security decisions, audit outcomes (high-level)

## What does *not* belong in `docs/`

- Generated build output (`dist/`)
- Temporary notes that aren't meant to live long-term
- Secrets or credentials

## Project documentation

| Document | Purpose |
|----------|---------|
| `docs/PRD.md` | Product Requirements Document — full feature specification, user journeys, platform strategy |
| `docs/CRON.md` | Cron and notification dispatch configuration, required secrets, endpoint behavior |
| `../PRD.md` *(root)* | Mirror of `docs/PRD.md` for quick access |
| `../CODEBASE_DOCUMENTATION.md` | Auto-generated per-file documentation of all 270 source files |
| `../CODEBASE_SRS.md` | Auto-generated Software Requirements Specification from the codebase |
| `../build-docs.js` | Script to generate `CODEBASE_DOCUMENTATION.md` |
| `../enhance-docs.js` | Post-processing script that adds rich descriptions to select key files |
