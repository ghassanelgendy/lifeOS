import chalk from "chalk";

const ACCENT = chalk.hex("#00D9FF");
const DIM = chalk.dim;
const GREEN = chalk.green;

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export interface Spinner {
  start(): void;
  stop(finalText?: string): void;
  update(text: string): void;
}

export function createSpinner(text: string): Spinner {
  let timer: NodeJS.Timeout | null = null;
  let index = 0;
  let currentText = text;
  const enabled = process.stdout.isTTY;

  function clearLine(): void {
    process.stdout.write("\r\x1b[K");
  }

  function render(): void {
    clearLine();
    process.stdout.write(`  ${ACCENT(FRAMES[index])} ${DIM(currentText)}`);
  }

  return {
    start() {
      if (!enabled || timer) {
        return;
      }

      render();
      timer = setInterval(() => {
        index = (index + 1) % FRAMES.length;
        render();
      }, 80);
    },

    update(newText: string) {
      currentText = newText;
      if (timer) {
        render();
      }
    },

    stop(finalText) {
      if (!enabled) {
        return;
      }

      if (timer) {
        clearInterval(timer);
        timer = null;
      }

      clearLine();
      const message = finalText ?? currentText;
      process.stdout.write(`  ${GREEN("✓")} ${message}\n`);
    },
  };
}
