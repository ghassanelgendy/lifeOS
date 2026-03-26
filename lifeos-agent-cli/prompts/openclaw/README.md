# OpenCLAW context for lifeOS

Load these MDs as system/context so OpenCLAW understands tables, tools, and behavior.

**One file (saves tokens):** Use **context-full.md** for a single, dense context block. Inject `TODAY` (YYYY-MM-DD) at runtime if your UI supports it.

**Modular:** Load in order: `skills-and-rules.md` → `tables.md` → `tools.md`.

| File | Purpose |
|------|--------|
| **context-full.md** | All-in-one: persona, tables summary, tools, rules (minimal tokens) |
| **skills-and-rules.md** | Persona, skills, what’s handled by CLI, response format |
| **tables.md** | All DB tables, columns, when to use each |
| **tools.md** | All tools, exact JSON input, filter ops, date rules, examples |
