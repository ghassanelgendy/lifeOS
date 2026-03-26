import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getKnownTableNames, getTableSchema, resolveKnownTableName } from "./dbSchema.js";

export interface RowFilter {
  column: string;
  op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "like" | "is_null" | "not_null";
  value?: unknown;
}

export interface FilterTableRowsInput {
  table: string;
  filters?: RowFilter[];
  limit?: number;
  order_by?: string;
  ascending?: boolean;
}

interface SupabaseToolsOptions {
  url?: string;
  anonKey?: string;
  /** If set, used instead of anon key; bypasses RLS so the CLI can read all rows. */
  serviceRoleKey?: string;
  allowedTables: Set<string>;
}

export class SupabaseTools {
  private readonly client: SupabaseClient | null;

  private readonly allowedTables: Set<string>;

  constructor(options: SupabaseToolsOptions) {
    this.allowedTables = options.allowedTables;

    const url = options.url;
    const key = options.serviceRoleKey ?? options.anonKey;

    if (url && key) {
      this.client = createClient(url, key, {
        auth: { persistSession: false },
      });
    } else {
      this.client = null;
    }
  }

  /** True if Supabase URL and anon key were provided and the client can be used. */
  isConfigured(): boolean {
    return this.client !== null;
  }

  listAllowedTables(): string[] {
    return [...this.allowedTables].sort();
  }

  listKnownTables(): string[] {
    return getKnownTableNames();
  }

  listReadableTables(): string[] {
    return this.listKnownTables().filter((table) => this.allowedTables.has(table));
  }

  getReadableSchema(): Array<{ table: string; columns: readonly string[] }> {
    return this.listReadableTables().map((table) => ({
      table,
      columns: getTableSchema(table)?.columns ?? [],
    }));
  }

  describeTable(table: string): { table: string; columns: readonly string[] } {
    const schema = getTableSchema(table);
    if (!schema) {
      throw new Error(
        `Unknown table '${table}'. Known tables: ${this.listKnownTables().join(", ")}`,
      );
    }

    if (!this.allowedTables.has(schema.table)) {
      throw new Error(
        `Table '${schema.table}' is not readable. Readable tables: ${this.listReadableTables().join(", ")}`,
      );
    }

    return schema;
  }

  async fetchTableRows(table: string, limit = 10): Promise<unknown[]> {
    if (!this.client) {
      throw new Error("Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY.");
    }

    const resolvedTable = resolveKnownTableName(table);
    if (!resolvedTable) {
      throw new Error(
        `Unknown table '${table}'. Known tables: ${this.listKnownTables().join(", ")}`,
      );
    }

    if (!this.allowedTables.has(resolvedTable)) {
      throw new Error(
        `Table '${resolvedTable}' is not readable. Readable tables: ${this.listReadableTables().join(", ")}`,
      );
    }

    const safeLimit = Math.max(1, Math.min(50, Math.floor(limit)));

    const query = this.client.from(resolvedTable).select("*").limit(safeLimit);

    // Best effort ordering; falls back automatically if column is missing.
    const ordered = await query.order("updated_at", { ascending: false });
    if (!ordered.error) {
      return ordered.data ?? [];
    }

    const fallback = await this.client.from(resolvedTable).select("*").limit(safeLimit);
    if (fallback.error) {
      throw new Error(`Supabase query failed: ${fallback.error.message}`);
    }

    return fallback.data ?? [];
  }

  async filterTableRows(input: FilterTableRowsInput): Promise<unknown[]> {
    if (!this.client) {
      throw new Error("Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY.");
    }

    const resolvedTable = resolveKnownTableName(input.table);
    if (!resolvedTable) {
      throw new Error(
        `Unknown table '${input.table}'. Known tables: ${this.listKnownTables().join(", ")}`,
      );
    }

    if (!this.allowedTables.has(resolvedTable)) {
      throw new Error(
        `Table '${resolvedTable}' is not readable. Readable tables: ${this.listReadableTables().join(", ")}`,
      );
    }

    const schema = getTableSchema(resolvedTable);
    const validColumns = new Set(schema?.columns ?? []);
    const safeLimit = Math.max(1, Math.min(500, Math.floor(input.limit ?? 10)));

    let query = this.client.from(resolvedTable).select("*");

    for (const filter of input.filters ?? []) {
      if (!validColumns.has(filter.column)) {
        throw new Error(
          `Unknown column '${filter.column}' on table '${resolvedTable}'. Valid columns: ${[...validColumns].join(", ")}`,
        );
      }

      switch (filter.op) {
        case "eq":
          query = query.eq(filter.column, filter.value);
          break;
        case "neq":
          query = query.neq(filter.column, filter.value);
          break;
        case "gt":
          query = query.gt(filter.column, filter.value);
          break;
        case "gte":
          query = query.gte(filter.column, filter.value);
          break;
        case "lt":
          query = query.lt(filter.column, filter.value);
          break;
        case "lte":
          query = query.lte(filter.column, filter.value);
          break;
        case "like":
          query = query.ilike(filter.column, `%${String(filter.value)}%`);
          break;
        case "is_null":
          query = query.is(filter.column, null);
          break;
        case "not_null":
          query = query.not(filter.column, "is", null);
          break;
      }
    }

    if (input.order_by && validColumns.has(input.order_by)) {
      query = query.order(input.order_by, { ascending: input.ascending ?? false });
    }

    const result = await query.limit(safeLimit);
    if (result.error) {
      throw new Error(`Supabase query failed: ${result.error.message}`);
    }

    return result.data ?? [];
  }

  async fetchTasksInDateRange(startDate: string, endDate: string, limit = 50): Promise<unknown[]> {
    if (!this.client) {
      throw new Error("Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY.");
    }

    if (!this.allowedTables.has("tasks")) {
      throw new Error(
        `Table 'tasks' is not readable. Readable tables: ${this.listReadableTables().join(", ")}`,
      );
    }

    const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));

    const query = await this.client
      .from("tasks")
      .select("id,title,due_date,due_time,priority,is_completed,is_urgent,is_flagged")
      .gte("due_date", startDate)
      .lte("due_date", endDate)
      .eq("is_completed", false)
      .order("due_date", { ascending: true })
      .order("due_time", { ascending: true, nullsFirst: false })
      .limit(safeLimit);

    if (query.error) {
      throw new Error(`Supabase query failed: ${query.error.message}`);
    }

    return query.data ?? [];
  }

  async fetchTasksForToday(limit = 25): Promise<unknown[]> {
    if (!this.client) {
      throw new Error("Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY.");
    }

    if (!this.allowedTables.has("tasks")) {
      throw new Error(
        `Table 'tasks' is not readable. Readable tables: ${this.listReadableTables().join(", ")}`,
      );
    }

    const today = new Date().toISOString().slice(0, 10);
    const safeLimit = Math.max(1, Math.min(50, Math.floor(limit)));

    return this.fetchTasksInDateRange(today, today, safeLimit);
  }

  /** Fetch sleep_sessions that ended on the given date (ISO YYYY-MM-DD). */
  async fetchSleepSessionsForDate(isoDate: string): Promise<unknown[]> {
    if (!this.client) {
      throw new Error("Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY.");
    }

    if (!this.allowedTables.has("sleep_sessions")) {
      throw new Error(
        `Table 'sleep_sessions' is not readable. Readable tables: ${this.listReadableTables().join(", ")}`,
      );
    }

    const start = `${isoDate}T00:00:00.000Z`;
    const endDate = new Date(isoDate + "T00:00:00.000Z");
    endDate.setUTCDate(endDate.getUTCDate() + 1);
    const end = endDate.toISOString();

    const result = await this.client
      .from("sleep_sessions")
      .select("id, started_at, ended_at, duration_minutes, sleep_score, rating")
      .gte("ended_at", start)
      .lt("ended_at", end)
      .order("ended_at", { ascending: false })
      .limit(10);

    if (result.error) {
      throw new Error(`Supabase query failed: ${result.error.message}`);
    }

    return result.data ?? [];
  }

  /** Fetch sleep_stages that started on the given date (ISO YYYY-MM-DD). */
  async fetchSleepStagesForDate(isoDate: string): Promise<unknown[]> {
    if (!this.client) {
      throw new Error("Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY.");
    }

    if (!this.allowedTables.has("sleep_stages")) {
      throw new Error(
        `Table 'sleep_stages' is not readable. Readable tables: ${this.listReadableTables().join(", ")}`,
      );
    }

    const start = `${isoDate}T00:00:00.000Z`;
    const endDate = new Date(isoDate + "T00:00:00.000Z");
    endDate.setUTCDate(endDate.getUTCDate() + 1);
    const end = endDate.toISOString();

    const result = await this.client
      .from("sleep_stages")
      .select("id, user_id, started_at, ended_at, duration_minutes, stage, created_at, session_id")
      .gte("started_at", start)
      .lt("started_at", end)
      .order("started_at", { ascending: true })
      .limit(100);

    if (result.error) {
      throw new Error(`Supabase query failed: ${result.error.message}`);
    }

    return result.data ?? [];
  }
}
