import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

function loadIfExists(filePath: string): void {
  if (!fs.existsSync(filePath)) {
    return;
  }

  dotenv.config({ path: filePath, override: false, quiet: true });
}

const currentFilePath = fileURLToPath(import.meta.url);
const moduleDir = path.dirname(currentFilePath);
const packageRoot = path.resolve(moduleDir, "..");
const cwd = process.cwd();

const explicitEnvPath = process.env.LIFEOS_AGENT_ENV;

if (explicitEnvPath) {
  loadIfExists(path.resolve(explicitEnvPath));
} else {
  loadIfExists(path.join(packageRoot, ".env"));
  loadIfExists(path.join(packageRoot, ".env.local"));

  if (cwd !== packageRoot) {
    loadIfExists(path.join(cwd, ".env"));
    loadIfExists(path.join(cwd, ".env.local"));
  }
}
