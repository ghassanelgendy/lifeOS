import chalk from "chalk";

const CYAN = chalk.cyan;
const DIM = chalk.dim;
const BOLD = chalk.bold;
const GREEN = chalk.green;
const YELLOW = chalk.yellow;
const RED = chalk.red;
const MAGENTA = chalk.magenta;
const WHITE = chalk.white;
const GRAY = chalk.gray;

const ACCENT = chalk.hex("#00D9FF");
const ACCENT2 = chalk.hex("#A78BFA");
const SURFACE = chalk.hex("#7C8BA1");
const MUTED = chalk.hex("#4B5563");

const L = ACCENT;
const R = ACCENT2;

const LOGO = `
 ${L("██╗")}      ${L("██╗")}   ${L("███████╗")}   ${L("███████╗")}      ${R("██████╗")}    ${R("███████╗")}
 ${L("██║")}      ${L("██║")}   ${L("██╔════╝")}   ${L("██╔════╝")}     ${R("██╔═══██╗")}   ${R("██╔════╝")}
 ${L("██║")}      ${L("██║")}   ${L("█████╗")}     ${L("█████╗")}       ${R("██║   ██║")}   ${R("███████╗")}
 ${L("██║")}      ${L("██║")}   ${L("██╔══╝")}     ${L("██╔══╝")}       ${R("██║   ██║")}   ${R("╚════██║")}
 ${L("███████╗")} ${L("██║")}   ${L("██║")}        ${L("███████╗")}     ${R("╚██████╔╝")}   ${R("███████║")}
 ${L("╚══════╝")} ${L("╚═╝")}   ${L("╚═╝")}        ${L("╚══════╝")}      ${R("╚═════╝")}    ${R("╚══════╝")}
`;

const SEPARATOR_CHAR = "─";

function separator(width = 50): string {
  return MUTED(SEPARATOR_CHAR.repeat(width));
}

function boxTop(width = 50): string {
  return MUTED("╭" + "─".repeat(width - 2) + "╮");
}

function boxBottom(width = 50): string {
  return MUTED("╰" + "─".repeat(width - 2) + "╯");
}

function boxLine(text: string, width = 50): string {
  const stripped = text.replace(/\u001b\[[0-9;]*m/g, "");
  const padding = Math.max(0, width - 4 - stripped.length);
  return MUTED("│") + " " + text + " ".repeat(padding) + " " + MUTED("│");
}

export function printBanner(): void {
  console.log(LOGO);
  console.log(ACCENT2("  ") + SURFACE("your life, locally managed") + "\n");
}

export function printWelcome(model: string, hasVault: boolean, hasSupabase: boolean): void {
  const statusWidth = 48;
  console.log(boxTop(statusWidth));
  console.log(boxLine(`${ACCENT("⚡")} Model    ${WHITE(model)}`, statusWidth));
  console.log(
    boxLine(
      `${hasVault ? GREEN("●") : RED("○")} Vault    ${hasVault ? GREEN("connected") : GRAY("not configured")}`,
      statusWidth,
    ),
  );
  console.log(
    boxLine(
      `${hasSupabase ? GREEN("●") : RED("○")} Database ${hasSupabase ? GREEN("connected") : GRAY("not configured")}`,
      statusWidth,
    ),
  );
  console.log(boxBottom(statusWidth));
  console.log("");
  console.log(
    "  " + DIM("Type a question to get started, or ") + ACCENT("/help") + DIM(" for commands."),
  );
  console.log("");
}

export function printHelp(): void {
  console.log("");
  console.log("  " + BOLD(ACCENT("Commands")));
  console.log("  " + separator(40));
  console.log("  " + ACCENT("/help    ") + SURFACE("Show this help menu"));
  console.log("  " + ACCENT("/model   ") + SURFACE("Show current model; /model <name> to switch"));
  console.log("  " + ACCENT("/trace   ") + SURFACE("Toggle trace mode (see agent reasoning)"));
  console.log("  " + ACCENT("/clear   ") + SURFACE("Clear conversation history"));
  console.log("  " + ACCENT("/exit    ") + SURFACE("End the session"));
  console.log("");
}

export function printModelMenu(currentModel: string, availableModels: readonly string[]): void {
  console.log("");
  console.log("  " + BOLD(ACCENT("Model")));
  console.log("  " + separator(40));
  console.log("  " + SURFACE("Current: ") + WHITE(currentModel));
  console.log("  " + SURFACE("Available:"));
  for (const m of availableModels) {
    console.log("  " + MUTED("  • ") + ACCENT(m));
  }
  console.log("  " + SURFACE("To change: ") + ACCENT("/model <name>") + SURFACE("  e.g. /model qwen3.5:397b-cloud"));
  console.log("");
}

export function printAgentResponse(answer: string): void {
  console.log("");
  console.log("  " + ACCENT2("◆") + " " + BOLD(WHITE("lifeOS")));
  console.log("  " + MUTED("│"));

  const lines = answer.split("\n");
  for (const line of lines) {
    console.log("  " + MUTED("│") + "  " + line);
  }

  console.log("  " + MUTED("│"));
  console.log("");
}

export function buildPrompt(traceEnabled: boolean): string {
  if (traceEnabled) {
    return ACCENT("  ❯ ") + YELLOW("[trace] ");
  }
  return ACCENT("  ❯ ");
}

export function printTrace(line: string): void {
  console.log("    " + DIM("⟐ ") + GRAY(line));
}

export function printInfo(message: string): void {
  console.log("  " + ACCENT("ℹ") + " " + SURFACE(message));
  console.log("");
}

export function printSuccess(message: string): void {
  console.log("  " + GREEN("✓") + " " + WHITE(message));
  console.log("");
}

export function printError(message: string): void {
  console.log("  " + RED("✗") + " " + RED(message));
  console.log("");
}

export function printDoctorSection(label: string, value: string, ok?: boolean): void {
  const status = ok === undefined ? ACCENT("⚡") : ok ? GREEN("●") : RED("○");
  const val = ok === false ? RED(value) : WHITE(value);
  console.log("  " + status + " " + SURFACE(label.padEnd(18)) + val);
}

export function printDoctorHeader(): void {
  console.log("");
  console.log("  " + BOLD(ACCENT("System Check")));
  console.log("  " + separator(40));
}

export function printDoctorTableLatest(entries: Array<{ table: string; text: string }>): void {
  console.log("  " + SURFACE("Latest entry per table:"));
  for (const { table, text } of entries) {
    const val = text === "no rows" ? GRAY(text) : WHITE(text);
    console.log("  " + MUTED("│") + "  " + SURFACE(table.padEnd(24)) + val);
  }
}

export function printDoctorFooter(): void {
  console.log("  " + separator(40));
  console.log("");
}

export function printGoodbye(): void {
  console.log("");
  console.log("  " + ACCENT2("◆") + " " + DIM("Until next time."));
  console.log("");
}

export { ACCENT, ACCENT2, CYAN, DIM, BOLD, GREEN, YELLOW, RED, MAGENTA, WHITE, GRAY, SURFACE, MUTED };
