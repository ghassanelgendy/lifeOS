import path from "node:path";

import { getKnownTableNames } from "./dbSchema.js";

/** Suggested models (local Ollama + cloud). Use any model name your server supports; /model in chat to switch. */
export const AVAILABLE_MODELS = [
 
  "qwen3.5:397b-cloud",
  "gpt-oss:120b",
  "nemotron-3-super:cloud",
  "llama3.2",
  "mistral",
  "qwen2.5:72b",
] as const;

export type AvailableModelName = (typeof AVAILABLE_MODELS)[number];

export interface AppConfig {
  ollamaBaseUrl: string;
  ollamaModel: string;
  ollamaApiKey?: string;
  ollamaNumPredict: number;
  obsidianVaultPath?: string;
  cacheDir: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  /** Service role key bypasses RLS — use for CLI so it can read user data. Keep secret. */
  supabaseServiceRoleKey?: string;
  supabaseAllowedTables: Set<string>;
}

function parseCsv(input: string | undefined): Set<string> {
  if (!input) {
    return new Set();
  }

  return new Set(
    input
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean),
  );
}

export function loadConfig(overrides?: Partial<AppConfig>): AppConfig {
  const cacheDir = overrides?.cacheDir ?? process.env.CACHE_DIR ?? ".lifeos-cache";

  return {
    ollamaBaseUrl:
      overrides?.ollamaBaseUrl ?? process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434",
    ollamaModel: overrides?.ollamaModel ?? process.env.OLLAMA_MODEL ?? "gpt-oss:120b",
    ollamaApiKey: overrides?.ollamaApiKey ?? process.env.OLLAMA_API_KEY,
    ollamaNumPredict: Number(overrides?.ollamaNumPredict ?? process.env.OLLAMA_NUM_PREDICT ?? 2048),
    obsidianVaultPath: overrides?.obsidianVaultPath ?? process.env.OBSIDIAN_VAULT_PATH,
    cacheDir: path.resolve(cacheDir),
    supabaseUrl:
      overrides?.supabaseUrl ?? process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL,
    supabaseAnonKey:
      overrides?.supabaseAnonKey ??
      process.env.SUPABASE_ANON_KEY ??
      process.env.VITE_SUPABASE_ANON_KEY,
    supabaseServiceRoleKey:
      overrides?.supabaseServiceRoleKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY,
    supabaseAllowedTables: (() => {
      const fromEnv = overrides?.supabaseAllowedTables ?? parseCsv(process.env.SUPABASE_ALLOWED_TABLES);
      return fromEnv.size > 0 ? fromEnv : new Set(getKnownTableNames());
    })(),
  };
}

export function validateAgentConfig(config: AppConfig): void {
  if (!config.ollamaBaseUrl) {
    throw new Error("Missing OLLAMA_BASE_URL.");
  }

  if (!config.ollamaModel) {
    throw new Error("Missing OLLAMA_MODEL.");
  }
}
