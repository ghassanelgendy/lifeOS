export type Role = "system" | "user" | "assistant";

export interface ChatMessage {
  role: Role;
  content: string;
}

export interface NotesSearchHit {
  path: string;
  title: string;
  score: number;
  snippet: string;
}

export interface AgentAction {
  tool: "search_notes" | "fetch_table_rows" | "filter_table_rows" | "today" | "list_tables" | "get_table_schema";
  input?: Record<string, unknown>;
}

export interface AgentStep {
  thought?: string;
  action?: AgentAction;
  final?: unknown;
}
