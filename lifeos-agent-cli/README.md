# lifeOS Agent CLI

Offline-first CLI agent that uses local Ollama models plus your Obsidian notes, with optional read-only Supabase data access.

## Features

- Local LLM runtime via Ollama (any model, e.g. `gpt-oss:120b`, `deepseek-r1:7b`)
- Local markdown note indexing and semantic-ish retrieval (no cloud dependency)
- Optional Supabase read tools with table allowlist
- Direct routing for common DB questions like table overview, schema lookup, and today's tasks
- Agent loop with iterative tool use (`search_notes`, `fetch_table_rows`, `today`, `list_tables`)

## 1) Install

```bash
cd lifeos-agent-cli
npm install
```

## 2) Configure env

```bash
cp .env.example .env
```

Edit `.env` values:

- `OBSIDIAN_VAULT_PATH`: absolute path to your vault
- `OLLAMA_MODEL`: the model you use (e.g. `gpt-oss:120b`, `deepseek-r1:7b`). Larger models give better tool use and reasoning.
- `OLLAMA_NUM_PREDICT`: max output tokens (default 2048; fine for 120B)
- Optional Supabase values if you want the agent to fetch lifeOS data

Env loading behavior:

- `life` loads `.env` from the CLI folder automatically, even if you run it from another directory
- You can override this by setting `LIFEOS_AGENT_ENV=/absolute/path/to/.env`

## 3) Ensure model is present

```bash
ollama pull <your-model>   # e.g. gpt-oss:120b or deepseek-r1:7b
```

## 4) Build a notes index

```bash
npm run index-notes -- --force
```

## 5) Start chat

```bash
life
```

This opens an interactive session so you can keep chatting without retyping `life`.

Session commands:

- `/help`
- `/trace`
- `/trace on`
- `/trace off`
- `/clear`
- `/exit`

## 6) Ask one-off questions

```bash
npm run ask -- "What tasks from my notes should I do today?"
```

## Optional: use `life` directly

One-time setup in this folder:

```bash
npm link
```

Then you can run:

```bash
life
life "What tasks from my notes should I do today?"
life --trace "What tasks from my notes should I do today?"
life chat
life doctor
life index-notes --vault "G:/MyVault"
```

Trace mode prints each turn, tool call, tool input, and result timing so you can see what the model is doing.

## Useful commands

- `npm run ask -- "summarize my weekly priorities"`
- `npm run index-notes -- --vault "G:/MyVault" --force`
- `npm run dev -- doctor`
 - `life> what are my tasks for today`
- `life> what are my tasks this week`

## Security model

- Supabase access is read-only and restricted to `SUPABASE_ALLOWED_TABLES`
- Agent never writes to Supabase
- Agent only reads local markdown notes from your configured vault path
