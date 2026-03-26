#!/usr/bin/env node
import "./env.js";

import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";

import { Command } from "commander";

import { runAgentQuestion, type AgentRuntime } from "./agent.js";
import { loadConfig, validateAgentConfig, AVAILABLE_MODELS } from "./config.js";
import { buildNotesIndex, loadNotesIndex } from "./notes.js";
import { checkOllamaHealth } from "./ollama.js";
import { createSpinner } from "./spinner.js";
import { SupabaseTools } from "./supabase.js";
import type { ChatMessage } from "./types.js";
import {
  printBanner,
  printWelcome,
  printHelp,
  printModelMenu,
  printAgentResponse,
  printTrace,
  printInfo,
  printSuccess,
  printError,
  printGoodbye,
  printDoctorHeader,
  printDoctorSection,
  printDoctorTableLatest,
  printDoctorFooter,
  buildPrompt,
  ACCENT,
  RED,
  WHITE,
} from "./ui.js";

const KNOWN_COMMANDS = new Set(["doctor", "index-notes", "ask", "chat", "help", "-h", "--help", "-V", "--version"]);

function normalizeArgv(argv: string[]): string[] {
  if (!argv.length) {
    return ["chat"];
  }

  const first = argv[0];
  if (KNOWN_COMMANDS.has(first)) {
    return argv;
  }

  if (argv.some((token) => KNOWN_COMMANDS.has(token))) {
    return argv;
  }

  const hasFreeText = argv.some((token) => !token.startsWith("-"));

  if (!hasFreeText) {
    return ["chat", ...argv];
  }

  return ["ask", ...argv];
}

async function createAgentRuntime(vault?: string): Promise<AgentRuntime> {
  const config = loadConfig({ obsidianVaultPath: vault });
  validateAgentConfig(config);

  let notesIndex = await loadNotesIndex(config.cacheDir);

  if (!notesIndex && config.obsidianVaultPath) {
    const spinner = createSpinner("Building notes index...");
    spinner.start();
    try {
      await buildNotesIndex(config.obsidianVaultPath, config.cacheDir);
    } finally {
      spinner.stop("Notes index ready");
    }
    notesIndex = await loadNotesIndex(config.cacheDir);
  }

  const supabase = new SupabaseTools({
    url: config.supabaseUrl,
    anonKey: config.supabaseAnonKey,
    serviceRoleKey: config.supabaseServiceRoleKey,
    allowedTables: config.supabaseAllowedTables,
  });

  return {
    ollamaBaseUrl: config.ollamaBaseUrl,
    ollamaModel: config.ollamaModel,
    ollamaApiKey: config.ollamaApiKey,
    ollamaNumPredict: config.ollamaNumPredict,
    notesIndex,
    supabase,
  };
}

async function askAgentQuestion(
  question: string,
  runtime: AgentRuntime,
  trace: boolean,
  priorMessages: ChatMessage[] = [],
): Promise<string> {
  const spinner = createSpinner("Thinking...");
  if (!trace) {
    spinner.start();
  }

  try {
    return await runAgentQuestion(
      question,
      runtime,
      {
        priorMessages,
        onTrace: trace
          ? (line: string) => {
              printTrace(line);
            }
          : undefined,
      },
    );
  } finally {
    if (!trace) {
      spinner.stop("Done");
    }
  }
}

async function startChatSession(options: { vault?: string; trace?: boolean }): Promise<void> {
  printBanner();

  const runtime = await createAgentRuntime(options.vault);
  const config = loadConfig({ obsidianVaultPath: options.vault });

  printWelcome(
    runtime.ollamaModel,
    Boolean(runtime.notesIndex),
    Boolean(config.supabaseUrl && config.supabaseAnonKey),
  );

  const history: ChatMessage[] = [];
  let traceEnabled = Boolean(options.trace);

  const rl = createInterface({
    input,
    output,
    terminal: Boolean(process.stdin.isTTY && process.stdout.isTTY),
  });

  try {
    while (true) {
      const prompt = buildPrompt(traceEnabled);
      const line = (await rl.question(prompt)).trim();

      if (!line) {
        continue;
      }

      if (line === "/exit" || line === "/quit") {
        printGoodbye();
        break;
      }

      if (line === "/help") {
        printHelp();
        continue;
      }

      if (line === "/clear") {
        history.length = 0;
        printInfo("Conversation cleared.");
        continue;
      }

      if (line === "/trace" || line === "/trace on") {
        traceEnabled = true;
        printInfo("Trace mode enabled — you'll see agent reasoning.");
        continue;
      }

      if (line === "/trace off") {
        traceEnabled = false;
        printInfo("Trace mode disabled.");
        continue;
      }

      const lower = line.toLowerCase();
      const isModelCmd =
        lower === "/model" ||
        lower.startsWith("/model ") ||
        lower === "model" ||
        lower.startsWith("model ");
      if (isModelCmd) {
        const rest = (
          lower.startsWith("/model")
            ? line.slice(line.toLowerCase().indexOf("/model") + "/model".length)
            : line.slice(line.toLowerCase().indexOf("model") + "model".length)
        ).trim();
        if (!rest) {
          printModelMenu(runtime.ollamaModel, AVAILABLE_MODELS);
          continue;
        }
        runtime.ollamaModel = rest;
        printSuccess(`Model set to: ${rest}`);
        continue;
      }

      const answer = await askAgentQuestion(line, runtime, traceEnabled, history);
      printAgentResponse(answer);

      history.push({ role: "user", content: line });
      history.push({ role: "assistant", content: answer });
    }
  } finally {
    rl.close();
  }
}

const program = new Command();

program
  .name("life")
  .description("Offline-first lifeOS CLI agent (Ollama + Obsidian + optional Supabase)")
  .version("0.1.0");

program
  .command("doctor")
  .description("Check local runtime configuration")
  .action(async () => {
    const config = loadConfig();
    validateAgentConfig(config);

    const ollamaOk = await checkOllamaHealth(config.ollamaBaseUrl, config.ollamaApiKey);

    printDoctorHeader();
    printDoctorSection("Ollama URL", config.ollamaBaseUrl);
    printDoctorSection("Model", config.ollamaModel);
    printDoctorSection("Auth", config.ollamaApiKey ? "configured" : "none");
    printDoctorSection("Max tokens", String(config.ollamaNumPredict));
    printDoctorSection("Ollama status", ollamaOk ? "reachable" : "unreachable", ollamaOk);
    printDoctorSection("Obsidian vault", config.obsidianVaultPath ?? "not set", Boolean(config.obsidianVaultPath));
    const supabaseConfigured = Boolean(
      config.supabaseUrl && (config.supabaseAnonKey || config.supabaseServiceRoleKey),
    );
    printDoctorSection("Supabase", supabaseConfigured ? "configured" : "not configured", supabaseConfigured);
    if (supabaseConfigured) {
      printDoctorSection(
        "Supabase key",
        config.supabaseServiceRoleKey ? "service_role (RLS bypass)" : "anon",
      );
    }
    printDoctorSection(
      "Allowed tables",
      [...config.supabaseAllowedTables].join(", ") || "none",
    );
    if (supabaseConfigured && config.supabaseAllowedTables.size > 0) {
      const supabase = new SupabaseTools({
        url: config.supabaseUrl,
        anonKey: config.supabaseAnonKey,
        serviceRoleKey: config.supabaseServiceRoleKey,
        allowedTables: config.supabaseAllowedTables,
      });
      const tables = [...config.supabaseAllowedTables].sort();
      const entries = await Promise.all(
        tables.map(async (table): Promise<{ table: string; text: string }> => {
          try {
            const rows = await supabase.fetchTableRows(table, 1);
            const row = rows[0] as Record<string, unknown> | undefined;
            if (!row) {
              return { table, text: "no rows" };
            }
            const updated = row.updated_at ?? row.created_at;
            const dateStr =
              typeof updated === "string"
                ? updated.slice(0, 10)
                : updated != null
                  ? String(updated).slice(0, 10)
                  : "—";
            return { table, text: dateStr };
          } catch (err) {
            return { table, text: `error: ${(err as Error).message}` };
          }
        }),
      );
      printDoctorTableLatest(entries);
      const allNoRows = entries.every((e) => e.text === "no rows");
      if (allNoRows && !config.supabaseServiceRoleKey) {
        console.log("");
        console.log("  " + RED("⚠") + "  " + WHITE("All tables show no rows. Your DB likely has RLS enabled, so the anon key sees nothing."));
        console.log("  " + "   " + "  " + "   Add " + ACCENT("SUPABASE_SERVICE_ROLE_KEY") + " to your .env (Project Settings → API → service_role secret) and restart.");
        console.log("");
      }
    }
    printDoctorFooter();
  });

program
  .command("index-notes")
  .description("Index markdown files from your Obsidian vault into local cache")
  .option("--vault <path>", "Obsidian vault path override")
  .action(async (options: { vault?: string }) => {
    const config = loadConfig({ obsidianVaultPath: options.vault });

    if (!config.obsidianVaultPath) {
      printError("Set OBSIDIAN_VAULT_PATH or pass --vault.");
      process.exit(1);
    }

    const spinner = createSpinner("Indexing Obsidian notes...");
    spinner.start();
    let result: { count: number; cacheFile: string };
    try {
      result = await buildNotesIndex(config.obsidianVaultPath, config.cacheDir);
    } finally {
      spinner.stop("Index built");
    }
    printSuccess(`Indexed ${result.count} notes → ${result.cacheFile}`);
  });

program
  .command("ask")
  .description("Ask the local lifeOS agent")
  .argument("<question...>", "Question for the agent")
  .option("--vault <path>", "Obsidian vault path override")
  .option("--trace", "Print step-by-step model and tool activity")
  .action(async (questionParts: string[], options: { vault?: string; trace?: boolean }) => {
    const question = questionParts.join(" ").trim();
    if (!question) {
      printError("Question is required.");
      process.exit(1);
    }

    const runtime = await createAgentRuntime(options.vault);
    const answer = await askAgentQuestion(question, runtime, Boolean(options.trace));
    printAgentResponse(answer);
  });

program
  .command("chat")
  .description("Start an interactive lifeOS chat session")
  .option("--vault <path>", "Obsidian vault path override")
  .option("--trace", "Print step-by-step model and tool activity")
  .action(async (options: { vault?: string; trace?: boolean }) => {
    await startChatSession(options);
  });

const rawArgv = process.argv.slice(2);
const normalizedArgv = normalizeArgv(rawArgv);

program.parseAsync([process.argv[0], process.argv[1], ...normalizedArgv]).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  printError(message);
  process.exit(1);
});
