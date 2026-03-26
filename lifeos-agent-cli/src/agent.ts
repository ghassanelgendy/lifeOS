import type { NotesSearchHit, AgentStep, ChatMessage } from "./types.js";
import { getTablePromptHint, type KnownTableName } from "./dbSchema.js";
import { ollamaChat } from "./ollama.js";
import { searchNotes } from "./notes.js";
import type { SupabaseTools, FilterTableRowsInput, RowFilter } from "./supabase.js";

interface SerializedIndex {
  builtAt: string;
  vaultPath: string;
  docs: Array<{ path: string; title: string; content: string }>;
}

export interface AgentRuntime {
  ollamaBaseUrl: string;
  ollamaModel: string;
  ollamaApiKey?: string;
  ollamaNumPredict: number;
  notesIndex: SerializedIndex | null;
  supabase: SupabaseTools;
}

interface AgentRunOptions {
  onTrace?: (line: string) => void;
  maxTurns?: number;
  priorMessages?: ChatMessage[];
}

function buildSystemPrompt(runtime: AgentRuntime): string {
  const readableTables = runtime.supabase.listReadableTables();
  const today = toIsoDate(new Date());
  const dayOfWeek = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const hasNotes = Boolean(runtime.notesIndex);
  const noteCount = runtime.notesIndex?.docs.length ?? 0;
  const hasDb = runtime.supabase.isConfigured() && readableTables.length > 0;
  const readableSchema = runtime.supabase.getReadableSchema();
  const schemaBlock =
    hasDb && readableSchema.length > 0
      ? `\nDatabase schema (use exact table/column names in tool calls). Each table lists when to use it and example questions:\n${readableSchema.map((s) => {
          const hint = getTablePromptHint(s.table as KnownTableName);
          return `- ${s.table} [${hint}]: ${s.columns.join(", ")}`;
        }).join("\n")}\n`
      : "";

  const tomorrowIso = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return toIsoDate(d);
  })();

  const monthStart = `${today.slice(0, 7)}-01`;
  const monthEnd = today;

  const howToFetchBlock = hasDb
    ? `

HOW TO FETCH DATA FROM THE DATABASE:
1) fetch_table_rows - use when you just need recent rows with no filter. Put in your action: {"tool": "fetch_table_rows", "input": {"table": "sleep_sessions", "limit": 10}}
2) filter_table_rows - use when you need rows matching a condition or date. Put in your action:
   - One condition: {"tool": "filter_table_rows", "input": {"table": "tasks", "filters": [{"column": "is_completed", "op": "eq", "value": false}], "limit": 20}}
   - Date on a specific day (e.g. sleep on ${today}): use two filters: started_at >= "${today}T00:00:00.000Z" AND started_at < "${tomorrowIso}T00:00:00.000Z". So: {"tool": "filter_table_rows", "input": {"table": "sleep_stages", "filters": [{"column": "started_at", "op": "gte", "value": "${today}T00:00:00.000Z"}, {"column": "started_at", "op": "lt", "value": "${tomorrowIso}T00:00:00.000Z"}], "limit": 100}}
   - Date column (e.g. due_date = ${today}): {"tool": "filter_table_rows", "input": {"table": "tasks", "filters": [{"column": "due_date", "op": "eq", "value": "${today}"}, {"column": "is_completed", "op": "eq", "value": false}], "limit": 25}}
   - Filter ops: "eq", "neq", "gt", "gte", "lt", "lte", "like", "is_null", "not_null". For "value" use the actual value (string, number, or boolean). Column names must match the schema exactly.
   - This month (for spending): use date gte "${monthStart}" and date lte "${monthEnd}". For "how much I spent" use table transactions, filter date in that range (and optionally type eq "expense" or cash_flow eq "Cash Out (-)" to exclude income), limit 500 (max), then SUM the amount field from the returned rows and answer with that total (e.g. "You spent 1,234 this month.").`
    : "";

  const examplesBlock = hasDb
    ? `

Examples: "How long did I sleep today?" → filter_table_rows sleep_stages with started_at gte "${today}T00:00:00.000Z" and lt "${tomorrowIso}T00:00:00.000Z", then sum duration_minutes in your final answer. "Tasks this week?" → filter_table_rows tasks with due_date gte "${today}", is_completed eq false. "How much did I spend this month?" → filter_table_rows transactions with date gte "${monthStart}" and date lte "${monthEnd}", limit 500; then in your final answer SUM the amount from the result and reply with one number (e.g. "You spent 1,234 this month."). Do not just list transactions - return the total.`
    : "";

  const tableList = hasDb ? readableTables.join(", ") : "";

  const persona = `You are lifeOS - the user's second brain and a perfect time-management operator. You excel at planning, lifestyle, and helping them stay on top of their life. You know about their tasks, calendar, sleep, spending, habits, projects, and notes. Your job is to use their real data (which you have read access to) to answer questions, summarize, and support decisions. Never say you lack access: you do. Act as their trusted operator for tasks, scheduling, wellness, and life clarity.`;

  return `${persona}

Today is ${dayOfWeek}, ${today}. Use ${today} for "today" in filters; use YYYY-MM-DD for "yesterday" or any other date.

WHAT YOU HAVE ACCESS TO:
${hasNotes ? `- The user's Obsidian notes (${noteCount} notes). Use search_notes for anything about their notes, personality, ideas, reflections.` : "- NOTES: Not configured."}
${hasDb ? `- The user's lifeOS database. You have read access to ALL of these tables (it is their data): ${tableList}. Use them whenever the user asks about tasks, sleep, spending, calendar, habits, screen time, transactions, projects, prayers, wellness, or anything that could be stored there. Each table below has a [hint] for when to use it. Default to querying: if the question might be answered by a table, call filter_table_rows or fetch_table_rows first, then answer from the result.` : "- DATABASE: Not configured."}
${schemaBlock}
${howToFetchBlock}

You MUST use the tables above whenever they are relevant. Do NOT say you "don't have access", "can't see their data", or "don't have enough information" - you do have access. (1) Match the question to a table using the [hints]. (2) Call filter_table_rows or fetch_table_rows with that table and the right filters (date columns: use "${today}" or YYYY-MM-DD, gte/lte for ranges). (3) Answer from the tool result. If the tool returns [], say no data was found for that period.
${examplesBlock}

Response format (raw JSON only, no markdown). Keep "thought" to one short phrase (e.g. "Use transactions for spending.") so the full JSON is not cut off:
{"thought": "short phrase", "action": {"tool": "...", "input": {...}}}
OR
{"final": "your answer to the user in plain text"}

Tools:
- search_notes: {"query": "terms", "k": 5}
- fetch_table_rows: {"table": "exact_name", "limit": 10}
- filter_table_rows: {"table": "exact_name", "filters": [{"column": "col", "op": "eq|neq|gt|gte|lt|lte|like|is_null|not_null", "value": ...}], "limit": 10, "order_by": "col", "ascending": true|false}
- list_tables / get_table_schema / today: use when needed

Rules:
- Output only one JSON object. No markdown, no text outside JSON.
- Use the database whenever possible: if the user's question could be answered by any table above, call the tool first. Do not answer from memory or say you lack access - you have their data.
- For every question about their life data (sleep, tasks, spending, calendar, habits, etc.): pick the table from [hints], call filter_table_rows or fetch_table_rows, then answer from the result.
- Date filters: use YYYY-MM-DD or full ISO for timestamp columns (e.g. ended_at: "${today}T00:00:00.000Z").
- Table/column names must match the schema exactly.
- If a tool returns [], say "No [X] found for [period]." Do not guess or invent data.
- When the user asks for a total or sum (e.g. "how much I spent this month", "total spending"), fetch the rows then SUM the relevant numeric field (e.g. amount) in your final answer. Reply with the total, not the raw list (e.g. "You spent 1,234 this month.").`;
}

function truncate(value: unknown, max = 4000): string {
  const raw = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return raw.length <= max ? raw : `${raw.slice(0, max)}\n...[truncated]`;
}

function extractBalancedJsonObject(raw: string): string | null {
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < raw.length; i += 1) {
    const char = raw[i];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (char === '"') {
        inString = false;
      }

      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") {
      if (depth === 0) {
        start = i;
      }
      depth += 1;
      continue;
    }

    if (char === "}") {
      if (depth === 0) {
        continue;
      }

      depth -= 1;
      if (depth === 0 && start >= 0) {
        return raw.slice(start, i + 1);
      }
    }
  }

  return null;
}

function stripThinkTags(raw: string): string {
  return raw.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

function parseAgentStep(raw: string): AgentStep {
  let cleaned = stripThinkTags(raw);
  const firstBrace = cleaned.indexOf("{");
  if (firstBrace > 0) {
    cleaned = cleaned.slice(firstBrace);
  }

  try {
    return JSON.parse(cleaned) as AgentStep;
  } catch {
    const sliced = extractBalancedJsonObject(cleaned);
    if (sliced) {
      return JSON.parse(sliced) as AgentStep;
    }

    const slicedFromRaw = extractBalancedJsonObject(raw);
    if (slicedFromRaw) {
      return JSON.parse(slicedFromRaw) as AgentStep;
    }

    throw new Error("Model output is not valid JSON.");
  }
}

function formatFinal(final: unknown): string {
  if (typeof final === "string") {
    return final.trim();
  }

  return JSON.stringify(final, null, 2);
}

function getActionFingerprint(step: AgentStep): string | null {
  if (!step.action) {
    return null;
  }

  return JSON.stringify({
    tool: step.action.tool,
    input: step.action.input ?? {},
  });
}

function getLastToolContext(history: ChatMessage[]): string | null {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const message = history[i];
    if (message.role !== "user") {
      continue;
    }

    if (message.content.startsWith("TOOL_RESULT") || message.content.startsWith("TOOL_ERROR")) {
      return message.content;
    }
  }

  return null;
}

/** Try to pull "final": "..." from broken or malformed JSON. */
function tryExtractFinalFromBrokenJson(raw: string): string | null {
  const t = raw.trim();
  const thinkEnd = t.lastIndexOf("</think>");
  const str = thinkEnd >= 0 ? t.slice(thinkEnd + 8).trim() : t;
  const quoted = str.match(/"final"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (quoted) {
    return quoted[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\").trim();
  }
  const unquoted = str.match(/"final"\s*:\s*([^,}\]]+)/);
  if (unquoted) {
    return unquoted[1].trim().replace(/^["']|["']$/g, "");
  }
  return null;
}

function extractPlainText(raw: string): string | null {
  let cleaned = raw.trim();

  const thinkClose = cleaned.lastIndexOf("</think>");
  if (thinkClose !== -1) {
    cleaned = cleaned.slice(thinkClose + 8).trim();
  }

  cleaned = cleaned.replace(/```[\s\S]*?```/g, "").trim();
  cleaned = cleaned.replace(/^[`\s]+|[`\s]+$/g, "").trim();

  if (cleaned.length > 0) {
    return cleaned;
  }

  return null;
}

function getLastAssistantContent(history: ChatMessage[]): string | null {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i].role === "assistant" && history[i].content.trim()) {
      return history[i].content;
    }
  }
  return null;
}

async function finalizeFromHistory(
  question: string,
  runtime: AgentRuntime,
  history: ChatMessage[],
  traceLog: (line: string) => void,
): Promise<string | null> {
  const lastToolContext = getLastToolContext(history);

  const contextBlock = lastToolContext
    ?? getLastAssistantContent(history)
    ?? "No tool results available.";

  traceLog("[finalize] requesting forced final answer");

  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "You are finalizing a lifeOS answer. Respond with raw JSON only in the shape {\"final\": \"plain text\"}. Do not call tools. Use the provided context to answer the user's original question directly. Be clear, concise, and helpful. If the data contains multiple items, present them as a numbered list. If there was an error, explain what went wrong simply.",
    },
    {
      role: "user",
      content: `Original user question:\n${question}\n\nContext:\n${contextBlock}`,
    },
  ];

  try {
    const output = await ollamaChat(
      runtime.ollamaBaseUrl,
      runtime.ollamaModel,
      runtime.ollamaApiKey,
      Math.min(runtime.ollamaNumPredict, 512),
      messages,
    );

    try {
      const step = parseAgentStep(output);
      if (typeof step.final !== "undefined") {
        const finalText = formatFinal(step.final);
        if (finalText.trim()) {
          traceLog("[finalize] forced final answer succeeded via JSON");
          return finalText;
        }
      }
    } catch {
      const plainText = extractPlainText(output);
      if (plainText) {
        traceLog("[finalize] forced final answer succeeded via text extraction");
        return plainText;
      }
    }
  } catch (error) {
    traceLog(`[finalize] forced final answer failed: ${(error as Error).message}`);
  }

  return null;
}

function buildLoopFallback(history: ChatMessage[]): string {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const msg = history[i];
    if (msg.role === "assistant") {
      const plain = extractPlainText(msg.content);
      if (plain) {
        return plain;
      }

      try {
        const step = parseAgentStep(msg.content);
        if (step.thought && step.thought.length > 30) {
          return step.thought;
        }
      } catch { /* ignore */ }
    }
  }

  const lastToolContext = getLastToolContext(history);
  if (lastToolContext) {
    if (lastToolContext.startsWith("TOOL_ERROR")) {
      return `Sorry, I ran into an error and couldn't complete your request. The issue was:\n${lastToolContext.replace(/^TOOL_ERROR[^:]*:\s*/, "")}`;
    }

    return `I found some data but couldn't formulate a complete answer. Here's what I found:\n${lastToolContext.replace(/^TOOL_RESULT[^:]*:\s*/, "")}`;
  }

  return "I wasn't able to answer that. Try rephrasing or asking something more specific. Use /trace to see what went wrong.";
}

function formatTasksForToday(rows: unknown[]): string {
  const tasks = rows as Array<{
    title?: string;
    due_date?: string | null;
    due_time?: string | null;
    priority?: string | null;
    is_urgent?: boolean;
    is_flagged?: boolean;
  }>;

  if (!tasks.length) {
    return "You have no incomplete tasks due today.";
  }

  const lines = tasks.map((task, index) => {
    const chips: string[] = [];
    if (task.due_time) {
      chips.push(`time ${task.due_time}`);
    }
    if (task.priority && task.priority !== "none") {
      chips.push(`priority ${task.priority}`);
    }
    if (task.is_urgent) {
      chips.push("urgent");
    }
    if (task.is_flagged) {
      chips.push("flagged");
    }

    return `${index + 1}. ${task.title ?? "Untitled task"}${chips.length ? ` (${chips.join(", ")})` : ""}`;
  });

  return [`Your tasks for today (${tasks.length}):`, ...lines].join("\n");
}

function formatTasksForRange(rows: unknown[], heading: string): string {
  const tasks = rows as Array<{
    title?: string;
    due_date?: string | null;
    due_time?: string | null;
    priority?: string | null;
    is_urgent?: boolean;
    is_flagged?: boolean;
  }>;

  if (!tasks.length) {
    return heading === "Your tasks for the next 7 days"
      ? "You have no incomplete tasks for the next 7 days."
      : `You have no incomplete tasks for ${heading.toLowerCase()}.`;
  }

  const lines = tasks.map((task, index) => {
    const chips: string[] = [];
    if (task.due_date) {
      chips.push(`date ${task.due_date}`);
    }
    if (task.due_time) {
      chips.push(`time ${task.due_time}`);
    }
    if (task.priority && task.priority !== "none") {
      chips.push(`priority ${task.priority}`);
    }
    if (task.is_urgent) {
      chips.push("urgent");
    }
    if (task.is_flagged) {
      chips.push("flagged");
    }

    return `${index + 1}. ${task.title ?? "Untitled task"}${chips.length ? ` (${chips.join(", ")})` : ""}`;
  });

  return [`${heading} (${tasks.length}):`, ...lines].join("\n");
}

function formatSleepAnswer(rows: unknown[], label: string): string {
  const sessions = rows as Array<{
    duration_minutes?: number | null;
    sleep_score?: number | null;
    rating?: number | null;
    started_at?: string | null;
    ended_at?: string | null;
  }>;

  if (!sessions.length) {
    return label === "today"
      ? "No sleep recorded for today yet. If you just woke up, your session might not be synced yet."
      : `No sleep recorded for ${label}.`;
  }

  const totalMins = sessions.reduce((sum, s) => sum + (Number(s.duration_minutes) || 0), 0);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  const durationStr = hours > 0 ? `${hours} ${hours === 1 ? "hour" : "hours"}${mins > 0 ? ` ${mins} minutes` : ""}` : `${mins} minutes`;

  const parts = [`You slept ${durationStr} ${label}.`];
  const withScore = sessions.find((s) => s.sleep_score != null);
  if (withScore && withScore.sleep_score != null) {
    parts.push(`Sleep score: ${withScore.sleep_score}.`);
  }
  if (sessions.length > 1) {
    parts.push(`(${sessions.length} sessions combined)`);
  }
  return parts.join(" ");
}

function toIsoDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function detectMentionedTable(question: string, runtime: AgentRuntime): string | null {
  const lower = question.toLowerCase();
  const tables = runtime.supabase.listKnownTables().sort((a, b) => b.length - a.length);

  for (const table of tables) {
    const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegex(table)}([^a-z0-9]|$)`, "i");
    if (pattern.test(lower)) {
      return table;
    }

    const spaced = table.replaceAll("_", " ");
    const spacedPattern = new RegExp(`(^|[^a-z0-9])${escapeRegex(spaced)}([^a-z0-9]|$)`, "i");
    if (spacedPattern.test(lower)) {
      return table;
    }
  }

  return null;
}

const TASK_TYPO_NORMALIZE: [RegExp, string][] = [
  [/\btsks\b/g, "tasks"],
  [/\btaks\b/g, "tasks"],
  [/\btaskes\b/g, "tasks"],
  [/\btodoes\b/g, "todos"],
];

function normalizeTaskQueryForMatch(q: string): string {
  let lower = q.toLowerCase();
  for (const [re, replacement] of TASK_TYPO_NORMALIZE) {
    lower = lower.replace(re, replacement);
  }
  return lower;
}

function looksLikeRawAgentJson(text: string): boolean {
  const t = text.trim();
  return (
    (t.startsWith('{"thought":') || t.startsWith('{"action":') || t.startsWith('{"final":')) &&
    (t.includes('"tool"') || t.includes("tool"))
  );
}

function sanitizeFinalAnswer(text: string): string {
  if (looksLikeRawAgentJson(text)) {
    return "I had trouble formatting that response. Try asking again, or use /trace to see what happened.";
  }
  return text;
}

async function tryDirectDatabaseAnswer(
  question: string,
  runtime: AgentRuntime,
  traceLog: (line: string) => void,
): Promise<string | null> {
  const lower = question.toLowerCase();
  const lowerForTasks = normalizeTaskQueryForMatch(question);
  const mentionedTable = detectMentionedTable(question, runtime);
  const isDatabaseOverviewQuery =
    /what tables|which tables|readable tables|list tables|database tables|db tables|see the database/.test(lower) ||
    /what(?:'s| is) in my (?:db|database)/.test(lower) ||
    /what do i have in my (?:db|database)/.test(lower) ||
    /show (?:me )?(?:my )?(?:db|database)/.test(lower) ||
    /summari[sz]e (?:my )?(?:db|database)/.test(lower) ||
    /overview of (?:my )?(?:db|database)/.test(lower);
  const taskKeyword = /(what|show|list|get|tell me|any|do i have|my).*(tasks?|todos?)/;
  const taskKeywordReverse = /(tasks?|todos?).*(today|tomorrow|this week|this month|overdue|upcoming|due)/;
  const isTaskQuery = taskKeyword.test(lowerForTasks) || taskKeywordReverse.test(lowerForTasks);

  const isTodayTasksQuery = isTaskQuery && /today|for today|due today/.test(lowerForTasks);
  const isTomorrowTasksQuery = isTaskQuery && /tomorrow|for tomorrow|due tomorrow/.test(lowerForTasks);
  const isWeekTasksQuery = isTaskQuery && /this week|for this week|week ahead|weekly|next 7 days/.test(lowerForTasks);
  const isMonthTasksQuery = isTaskQuery && /this month|for this month|month ahead|monthly/.test(lowerForTasks);
  const isOverdueTasksQuery = isTaskQuery && /overdue|past due|missed|late/.test(lowerForTasks);
  const isUpcomingTasksQuery = isTaskQuery && /upcoming|coming up|soon|next/.test(lowerForTasks) && !isWeekTasksQuery;

  if (isTodayTasksQuery) {
    traceLog("[direct] resolved as today-tasks query");
    const rows = await runtime.supabase.fetchTasksForToday(25);
    return formatTasksForToday(rows);
  }

  if (isTomorrowTasksQuery) {
    traceLog("[direct] resolved as tomorrow-tasks query");
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const date = toIsoDate(tomorrow);
    const rows = await runtime.supabase.fetchTasksInDateRange(date, date, 25);
    return formatTasksForRange(rows, "Your tasks for tomorrow");
  }

  if (isWeekTasksQuery) {
    traceLog("[direct] resolved as week-tasks query");
    const start = new Date();
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const rows = await runtime.supabase.fetchTasksInDateRange(toIsoDate(start), toIsoDate(end), 50);
    return formatTasksForRange(rows, "Your tasks for the next 7 days");
  }

  if (isMonthTasksQuery) {
    traceLog("[direct] resolved as month-tasks query");
    const start = new Date();
    const end = new Date(start);
    end.setDate(end.getDate() + 30);
    const rows = await runtime.supabase.fetchTasksInDateRange(toIsoDate(start), toIsoDate(end), 100);
    return formatTasksForRange(rows, "Your tasks for the next 30 days");
  }

  if (isOverdueTasksQuery) {
    traceLog("[direct] resolved as overdue-tasks query");
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const rows = await runtime.supabase.fetchTasksInDateRange("2000-01-01", toIsoDate(yesterday), 50);
    return formatTasksForRange(rows, "Your overdue tasks");
  }

  if (isUpcomingTasksQuery) {
    traceLog("[direct] resolved as upcoming-tasks query");
    const start = new Date();
    const end = new Date(start);
    end.setDate(end.getDate() + 14);
    const rows = await runtime.supabase.fetchTasksInDateRange(toIsoDate(start), toIsoDate(end), 50);
    return formatTasksForRange(rows, "Your upcoming tasks (next 14 days)");
  }

  const spendingThisMonth =
    /how much (did i |have i )?spent this month|how much (did i )?spend this month|spending this month|total spent this month/i.test(lower);
  if (spendingThisMonth && runtime.supabase.isConfigured() && runtime.supabase.listReadableTables().includes("transactions")) {
    traceLog("[direct] resolved as spending-this-month query");
    const now = new Date();
    const monthStart = `${toIsoDate(now).slice(0, 7)}-01`;
    const monthEnd = toIsoDate(now);
    const rows = await runtime.supabase.filterTableRows({
      table: "transactions",
      filters: [
        { column: "date", op: "gte", value: monthStart },
        { column: "date", op: "lte", value: monthEnd },
      ],
      limit: 500,
    });
    const total = (rows as Array<{ amount?: number }>).reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    if (rows.length === 0) {
      return "No expenses recorded this month.";
    }
    return `You spent ${total.toLocaleString()} this month (${rows.length} transaction${rows.length === 1 ? "" : "s"}).`;
  }

  const sleepTodayOrYesterday =
    /(how long|how much|how many hours).*(did i )?sleep\s*(today|this morning|last night)|sleep\s*(today|this morning|last night)/i.test(lower) ||
    /(how long|how much|how many hours).*(did i )?sleep.*yesterday|sleep.*yesterday/i.test(lower);
  if (sleepTodayOrYesterday && runtime.supabase.listReadableTables().includes("sleep_stages")) {
    const forYesterday = /yesterday/i.test(lower);
    const date = new Date();
    if (forYesterday) {
      date.setDate(date.getDate() - 1);
    }
    const isoDate = toIsoDate(date);
    traceLog(`[direct] resolved as sleep query for ${forYesterday ? "yesterday" : "today"} (${isoDate})`);
    const rows = await runtime.supabase.fetchSleepStagesForDate(isoDate);
    return formatSleepAnswer(rows, forYesterday ? "yesterday" : "today");
  }

  const hasAvgSleep = /(average|avg|mean)/i.test(lower) && /sleep/i.test(lower);
  const hasThisMonth = /this month|monthly|current month/i.test(lower);
  const avgSleepThisMonth = hasAvgSleep && hasThisMonth;
  if (avgSleepThisMonth && runtime.supabase.isConfigured() && runtime.supabase.listReadableTables().includes("sleep_stages")) {
    traceLog("[direct] resolved as average-sleep-this-month query");
    const now = new Date();
    const monthStart = `${toIsoDate(now).slice(0, 7)}-01T00:00:00.000Z`;
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const monthEnd = nextMonth.toISOString();
    const rows = await runtime.supabase.filterTableRows({
      table: "sleep_stages",
      filters: [
        { column: "started_at", op: "gte", value: monthStart },
        { column: "started_at", op: "lt", value: monthEnd },
      ],
      limit: 500,
    });
    const stages = rows as Array<{ duration_minutes?: number | null }>;
    if (stages.length === 0) {
      return "No sleep stages recorded this month.";
    }
    const totalMins = stages.reduce((sum, s) => sum + (Number(s.duration_minutes) || 0), 0);
    const avgMins = Math.round(totalMins / stages.length);
    const hours = Math.floor(avgMins / 60);
    const mins = avgMins % 60;
    const durationStr =
      hours > 0
        ? `${hours} ${hours === 1 ? "hour" : "hours"}${mins > 0 ? ` ${mins} minutes` : ""}`
        : `${mins} minutes`;
    return `Your average sleep this month is ${durationStr} (${stages.length} stage${stages.length === 1 ? "" : "s"}).`;
  }

  if (isDatabaseOverviewQuery) {
    const readableTables = runtime.supabase.listReadableTables();
    traceLog(`[direct] resolved as readable-tables query with ${readableTables.length} tables`);

    if (!readableTables.length) {
      return "There are currently no readable tables configured in this session.";
    }

    return [
      `Your readable database tables (${readableTables.length}):`,
      readableTables.join(", "),
      "",
      "Ask naturally for more detail, for example:",
      "- what is in my tasks table",
      "- show me the schema for tasks",
      "- fetch 5 rows from projects",
    ].join("\n");
  }

  if ((/schema|columns|describe table|describe/.test(lower)) && mentionedTable) {
    traceLog(`[direct] resolved as schema query for ${mentionedTable}`);
    return JSON.stringify(runtime.supabase.describeTable(mentionedTable), null, 2);
  }

  if ((/fetch|show|get|list|recent|latest/.test(lower)) && mentionedTable) {
    const countMatch = lower.match(/\b(\d{1,2})\b/);
    const limit = countMatch ? Number(countMatch[1]) : 5;
    traceLog(`[direct] resolved as row fetch for ${mentionedTable} with limit ${limit}`);
    const rows = await runtime.supabase.fetchTableRows(mentionedTable, limit);
    return JSON.stringify({ table: mentionedTable, limit, rows }, null, 2);
  }

  return null;
}

async function runTool(
  action: NonNullable<AgentStep["action"]>,
  runtime: AgentRuntime,
): Promise<string> {
  switch (action.tool) {
    case "search_notes": {
      if (!runtime.notesIndex) {
        return "No notes index loaded. Run index-notes first and set OBSIDIAN_VAULT_PATH.";
      }

      const query = String(action.input?.query ?? "").trim();
      const k = Number(action.input?.k ?? 5);
      const hits: NotesSearchHit[] = searchNotes(runtime.notesIndex, query, k);
      return JSON.stringify(hits, null, 2);
    }

    case "fetch_table_rows": {
      const table = String(action.input?.table ?? "").trim();
      const limit = Number(action.input?.limit ?? 10);
      const rows = await runtime.supabase.fetchTableRows(table, limit);
      return JSON.stringify(rows, null, 2);
    }

    case "filter_table_rows": {
      const filterInput: FilterTableRowsInput = {
        table: String(action.input?.table ?? "").trim(),
        filters: Array.isArray(action.input?.filters)
          ? (action.input.filters as RowFilter[])
          : [],
        limit: Number(action.input?.limit ?? 10),
        order_by: action.input?.order_by ? String(action.input.order_by) : undefined,
        ascending: typeof action.input?.ascending === "boolean" ? action.input.ascending : undefined,
      };
      const rows = await runtime.supabase.filterTableRows(filterInput);
      return JSON.stringify(rows, null, 2);
    }

    case "list_tables": {
      return JSON.stringify(
        {
          readableTables: runtime.supabase.listReadableTables(),
          readableSchema: runtime.supabase.getReadableSchema(),
        },
        null,
        2,
      );
    }

    case "get_table_schema": {
      const table = String(action.input?.table ?? "").trim();
      return JSON.stringify(runtime.supabase.describeTable(table), null, 2);
    }

    case "today": {
      return new Date().toISOString();
    }

    default: {
      return `Unknown tool: ${String(action.tool)}`;
    }
  }
}

export async function runAgentQuestion(
  question: string,
  runtime: AgentRuntime,
  options: AgentRunOptions = {},
): Promise<string> {
  const trace = options.onTrace;
  const maxTurns = options.maxTurns ?? 6;
  const traceLog = (line: string): void => {
    if (trace) {
      trace(line);
    }
  };

  const directAnswer = await tryDirectDatabaseAnswer(question, runtime, traceLog);
  if (directAnswer) {
    return sanitizeFinalAnswer(directAnswer);
  }

  const isSleepQuestion = /sleep|how long did i sleep|how much did i sleep/i.test(question);
  if (isSleepQuestion) {
    if (!runtime.supabase.isConfigured()) {
      return "Sleep data comes from your Supabase database. Set SUPABASE_URL and SUPABASE_ANON_KEY in your .env, add sleep_stages to SUPABASE_ALLOWED_TABLES, then try again.";
    }
    if (!runtime.supabase.listReadableTables().includes("sleep_stages")) {
      return "Sleep data isn't available in this session. Add sleep_stages to SUPABASE_ALLOWED_TABLES in your .env and restart the app.";
    }
  }

  const history: ChatMessage[] = [...(options.priorMessages ?? []), { role: "user", content: question }];
  let previousActionFingerprint: string | null = null;
  let repeatedActionCount = 0;

  for (let i = 0; i < maxTurns; i += 1) {
    traceLog(`[turn ${i + 1}] sending prompt to model`);
    const messages: ChatMessage[] = [{ role: "system", content: buildSystemPrompt(runtime) }, ...history];
    const modelStart = Date.now();
    const modelOutput = await ollamaChat(
      runtime.ollamaBaseUrl,
      runtime.ollamaModel,
      runtime.ollamaApiKey,
      runtime.ollamaNumPredict,
      messages,
    );
    traceLog(`[turn ${i + 1}] model response received in ${Date.now() - modelStart} ms`);

    let step: AgentStep;
    try {
      step = parseAgentStep(modelOutput);
      traceLog(`[turn ${i + 1}] parsed response keys: ${Object.keys(step).join(", ") || "none"}`);
    } catch (err) {
      traceLog(`[turn ${i + 1}] parse error: ${(err as Error).message}`);
      const fromBroken = tryExtractFinalFromBrokenJson(modelOutput);
      if (fromBroken && fromBroken.trim().length > 0) {
        traceLog(`[turn ${i + 1}] using extracted "final" from broken JSON`);
        return sanitizeFinalAnswer(fromBroken.trim());
      }
      const plainAnswer = extractPlainText(modelOutput);
      const looksTruncated =
        plainAnswer != null &&
        (plainAnswer.trimStart().startsWith('{"thought":') || plainAnswer.trimStart().startsWith('{"action":')) &&
        !plainAnswer.includes('"final"');
      if (plainAnswer && plainAnswer.trim().length > 0 && !looksTruncated) {
        traceLog(`[turn ${i + 1}] using raw output as final answer (${plainAnswer.length} chars)`);
        return sanitizeFinalAnswer(plainAnswer.trim());
      }
      if (getLastToolContext(history)) {
        traceLog(`[turn ${i + 1}] parse failed but we have tool result, forcing finalize`);
        const forced = await finalizeFromHistory(question, runtime, history, traceLog);
        if (forced) {
          return sanitizeFinalAnswer(forced);
        }
      }
      history.push({ role: "assistant", content: modelOutput });
      history.push({
        role: "user",
        content:
          'Your reply was cut off or invalid. Reply with ONLY: {"final": "your answer in one short sentence"}. Nothing else.',
      });
      continue;
    }

    if (step.thought) {
      traceLog(`[turn ${i + 1}] thought: ${truncate(step.thought, 240)}`);
    }

    if (typeof step.final !== "undefined") {
      const finalText = formatFinal(step.final);
      if (!finalText.trim()) {
        traceLog(`[turn ${i + 1}] final was empty after formatting`);
      } else {
        traceLog(`[turn ${i + 1}] final answer ready`);
        return sanitizeFinalAnswer(finalText);
      }
    }

    if (!step.action) {
      traceLog(`[turn ${i + 1}] missing action and final, requesting correction`);
      history.push({ role: "assistant", content: modelOutput });
      history.push({
        role: "user",
        content: "Your response missed both action and final. Respond with valid JSON using either an action or final.",
      });
      continue;
    }

    const actionFingerprint = getActionFingerprint(step);
    if (actionFingerprint && actionFingerprint === previousActionFingerprint) {
      repeatedActionCount += 1;
    } else {
      repeatedActionCount = 0;
      previousActionFingerprint = actionFingerprint;
    }

    if (repeatedActionCount >= 1) {
      traceLog(`[turn ${i + 1}] detected repeated tool call pattern, forcing finalization`);
      const forcedFinal = await finalizeFromHistory(question, runtime, history, traceLog);
      if (forcedFinal) {
        return sanitizeFinalAnswer(forcedFinal);
      }
    }

    try {
      traceLog(
        `[turn ${i + 1}] tool call: ${step.action.tool} input=${truncate(step.action.input ?? {}, 240)}`,
      );
      const toolStart = Date.now();
      const toolResult = await runTool(step.action, runtime);
      traceLog(
        `[turn ${i + 1}] tool result (${Date.now() - toolStart} ms): ${truncate(toolResult, 400)}`,
      );
      history.push({ role: "assistant", content: JSON.stringify(step) });

      const turnsLeft = maxTurns - i - 1;
      const nudge =
        turnsLeft <= 1
          ? "\nYou MUST respond with {\"final\": \"...\"} now. No more tool calls."
          : "\nIf you have enough information, respond with {\"final\": \"...\"}. Otherwise, call another tool.";

      history.push({
        role: "user",
        content: `TOOL_RESULT for ${step.action.tool}:\n${toolResult}${nudge}`,
      });
    } catch (err) {
      traceLog(`[turn ${i + 1}] tool error: ${(err as Error).message}`);
      history.push({ role: "assistant", content: JSON.stringify(step) });
      history.push({
        role: "user",
        content: `TOOL_ERROR for ${step.action.tool}: ${(err as Error).message}\nRespond with {"final": "..."} explaining the issue, or try a different tool call.`,
      });
    }
  }

  const forcedFinal = await finalizeFromHistory(question, runtime, history, traceLog);
  if (forcedFinal) {
    return sanitizeFinalAnswer(forcedFinal);
  }

  return sanitizeFinalAnswer(buildLoopFallback(history));
}
