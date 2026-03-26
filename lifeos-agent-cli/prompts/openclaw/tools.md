# lifeOS tools (exact JSON)

Replace `TODAY` with YYYY-MM-DD (today), `TOMORROW` with next day YYYY-MM-DD, `MONTH_START` with YYYY-MM-01, `MONTH_END` with today YYYY-MM-DD. Timestamps: use `YYYY-MM-DDTHH:MM:SS.000Z` (e.g. `TODAYT00:00:00.000Z` for start of day).

---

## Supabase and queries (short)

- **Data source:** User data is in Supabase. You never write SQL; you call **fetch_table_rows** or **filter_table_rows**. The system runs the query and returns a JSON array of rows.
- **Getting a query:** (1) Pick table from **tables.md** by matching the question to the table hint. (2) No filter → **fetch_table_rows**. (3) With date/condition → **filter_table_rows** with `filters` (exact column names, ops: eq, neq, gt, gte, lt, lte, like, is_null, not_null). (4) Date column: use YYYY-MM-DD. Timestamp column: use ISO; for "one day" use gte `DayT00:00:00.000Z` and lt `NextDayT00:00:00.000Z`.
- **Analyzing results:** Empty `[]` → say "No [X] found." For totals (e.g. spending): **SUM** the numeric field (e.g. `amount`) and reply with that number. For averages: sum field, divide by row count, format (e.g. hours/minutes). For lists: summarize rows (titles, dates); don’t dump raw JSON. See **skills-and-rules.md** for full "Supabase: how to get and run queries" and "how to analyze the result."

---

## 1. search_notes

Obsidian notes search. Use for personality, ideas, reflections, anything in notes.

```json
{"tool": "search_notes", "input": {"query": "terms to search", "k": 5}}
```

---

## 2. fetch_table_rows

Recent rows, no filter. Use when no date/condition needed.

```json
{"tool": "fetch_table_rows", "input": {"table": "sleep_sessions", "limit": 10}}
```

---

## 3. filter_table_rows

Rows matching conditions. **Always use exact table/column names from tables.md.**

**Filter ops:** `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `like`, `is_null`, `not_null`. For `like` value use string; for `is_null`/`not_null` omit `value`. Other ops: `value` = string, number, or boolean.

**Optional:** `order_by`: column name; `ascending`: true/false. Limit max 500.

**Examples:**

- Tasks incomplete:
```json
{"tool": "filter_table_rows", "input": {"table": "tasks", "filters": [{"column": "is_completed", "op": "eq", "value": false}], "limit": 20}}
```

- Sleep on a specific day (use **ended_at** for sleep_sessions; day = START to START+1):
```json
{"tool": "filter_table_rows", "input": {"table": "sleep_sessions", "filters": [{"column": "ended_at", "op": "gte", "value": "TODAYT00:00:00.000Z"}, {"column": "ended_at", "op": "lt", "value": "TOMORROWT00:00:00.000Z"}], "limit": 10}}
```

- Tasks due today, incomplete:
```json
{"tool": "filter_table_rows", "input": {"table": "tasks", "filters": [{"column": "due_date", "op": "eq", "value": "TODAY"}, {"column": "is_completed", "op": "eq", "value": false}], "limit": 25}}
```

- Tasks this week (due_date in range):
```json
{"tool": "filter_table_rows", "input": {"table": "tasks", "filters": [{"column": "due_date", "op": "gte", "value": "TODAY"}, {"column": "due_date", "op": "lte", "value": "END_OF_WEEK_YYYY-MM-DD"}], "limit": 50}}
```

- Spending this month (then SUM amount in your answer):
```json
{"tool": "filter_table_rows", "input": {"table": "transactions", "filters": [{"column": "date", "op": "gte", "value": "MONTH_START"}, {"column": "date", "op": "lte", "value": "MONTH_END"}], "limit": 500}}
```

- Average sleep this month: filter **sleep_sessions** (or sleep_stages) on **ended_at** (or **started_at**) gte `MONTH_START` (as ISO), lt first day next month; then average **duration_minutes** in your answer.

---

## 4. list_tables

Returns readable table names and schema. No input.

```json
{"tool": "list_tables", "input": {}}
```

---

## 5. get_table_schema

Describe one table (columns, types). Use when unsure of column names.

```json
{"tool": "get_table_schema", "input": {"table": "tasks"}}
```

---

## 6. today

Returns current ISO timestamp. No input.

```json
{"tool": "today", "input": {}}
```

---

## Response format (you → system)

Output **exactly one** JSON object. No markdown, no text before/after.

- To call a tool:
```json
{"thought": "short phrase", "action": {"tool": "tool_name", "input": {...}}}
```

- To answer the user (after tools or when no tool needed):
```json
{"final": "Your answer in plain text."}
```

Keep `thought` to one short phrase so the JSON is not cut off. For totals (spending, sleep duration): fetch rows then **SUM** or **average** the numeric field and put that in `final` (e.g. "You spent 1,234 this month."). Do not return raw row lists for "how much" / "total" questions.
