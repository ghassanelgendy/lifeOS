# Code Map — for AI agents

A structured code graph of this repo, built so an agent can find the right files for a
task **without** grepping or reading the whole tree.

## Files

| File | What it is | When to load it |
|---|---|---|
| `CODEMAP.md` | Compact map: task router, entry points, platform-variant matrix, feature→hook→table map, change-risk hubs, invariants. | **Always load first.** |
| `graph.json` | Full node/edge graph. Every module with `imports`, `importedBy`, `exports`, `tables`, `queryKeys`, `invokesEdgeFns`. | When you need exact callers/callees. Query with `jq`, don't read whole. |
| `tables.json` | Reverse index: Supabase table → every module touching it; edge function → definition + callers. | When changing a table, column, or edge function. |

## Intended agent workflow

```
CODEMAP.md  →  §1 Task router  →  §3 Platform variants  →  jq graph.json  →  open 2–5 files
```

The point is to replace a broad `grep`/`find` sweep (which pulls a lot of irrelevant
file content into context) with two targeted reads.

## Useful queries

```bash
# What does this module import, and who imports it?
jq '.nodes[] | select(.id=="src/hooks/useTasks.web.ts") | {imports, importedBy}' \
  .agents/codemap/graph.json

# Blast radius of a change (direct dependents)
jq -r '.nodes[] | select(.id=="src/lib/supabase.ts") | .importedBy[]' \
  .agents/codemap/graph.json

# Every module that touches a table
jq -r '.tables[] | select(.table=="transactions") | .readWrite[]' \
  .agents/codemap/tables.json

# Variant families missing an .ios implementation (iOS build risk)
jq -r '.variantFamilies[] | select(.ios==null) | .base' .agents/codemap/graph.json

# All modules issuing React Query calls
jq -r '.nodes[] | select(.usesReactQuery) | .id' .agents/codemap/graph.json

# Find where a query key is defined
jq -r '.nodes[] | select(.queryKeys[]? == "tasks") | .id' .agents/codemap/graph.json
```

## Regenerating

```bash
node scripts/build-codemap.mjs
```

Run it after adding/removing/moving modules, or changing imports. It is cheap
(single pass, no deps, no network) and deterministic apart from the `generatedAt`
timestamp.

## Design notes

**Regex extraction, not a full TS AST.** This repo pins `typescript` to
`@typescript/typescript6` and also carries a `@typescript/native` 7.x devDependency;
`scripts/lint.mjs` already self-skips because typescript-eslint doesn't support TS 7
yet. A generator built on the TS compiler API or `ts-morph` would be coupled to that
churn. Regex extraction is resilient and fast, at the cost of some precision:

- Re-exports (`export * from './x.platform'`) are followed as edges, but symbols are
  not transitively flattened — `exports` lists what each file declares itself.
- `.platform` specifiers resolve as the **web** variant (matching `vitest.config.ts`),
  with `ios`/`pake` recorded separately in `variantFamilies`.
- Tables are detected from literal `.from('x')`. A table name built from a variable
  won't be captured.
- Feature-map hook/table columns are transitive to depth 2, so they show *reachable*
  data, not strictly first-paint data.

Treat the JSON as a high-recall index for navigation, not a verified contract. When a
decision depends on an exact symbol or call site, open the file.
