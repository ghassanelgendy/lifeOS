# lifeOS Agent Handoff Schema (v1)

This repo versioned schema defines the **exact output block** that every role-spec agent must produce.

## Contract
- Output must contain **exactly one** code block fenced as: \`lifeos-agent-handoff\`
- The code block must contain **valid JSON**
- JSON must contain these top-level keys:
  - `goal`
  - `scope`
  - `files_touched`
  - `definition_of_done`
  - `risks`
  - `testing_plan`
  - `artifacts`

## JSON Shape

```lifeos-agent-handoff
{
  "goal": "string",
  "scope": {
    "routes": ["string"],
    "components": ["string"],
    "stores": ["string"],
    "hooks": ["string"],
    "lib": ["string"],
    "db": ["string"],
    "migrations": ["string"]
  },
  "files_touched": ["string"],
  "definition_of_done": ["string"],
  "risks": ["string"],
  "testing_plan": {
    "automated": ["string"],
    "manual": ["string"]
  },
  "artifacts": {
    "pr_url": "string",
    "deployment_url": "string",
    "log_snippets": ["string"]
  }
}
```

## Notes
- Prefer repo-relative paths (e.g. `src/routes/Dashboard.tsx`), not absolute paths.
- If an artifact is not yet available, use an empty string (`""`) or `[]` for arrays.
- Keep `files_touched` aligned with `scope` and only include files the agent intends to change (or already changed if it is in an execution phase).

