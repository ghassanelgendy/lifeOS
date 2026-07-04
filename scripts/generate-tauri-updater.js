import fs from 'fs';
import { execSync } from 'child_process';

const privateKey = process.env.TAURI_PRIVATE_KEY;
const password = process.env.TAURI_KEY_PASSWORD || "";

if (!privateKey) {
  console.log("⚠️ TAURI_PRIVATE_KEY is missing from environment. Skipping updater.json generation.");
  process.exit(0);
}

// 1. Zip the MSI (Tauri updater requires the MSI to be inside a ZIP)
console.log("🤐 Zipping lifeOS.msi...");
try {
  // Use PowerShell Compress-Archive
  execSync("powershell -Command \"Compress-Archive -Path lifeOS.msi -DestinationPath lifeOS.msi.zip -Force\"");
  console.log("✅ Created lifeOS.msi.zip");
} catch (err) {
  console.error("❌ Failed to zip lifeOS.msi:", err);
  process.exit(1);
}

// 2. Sign the Zip file
console.log("✍️ Signing lifeOS.msi.zip...");
let signature = "";
try {
  // Pass credentials as env vars for @tauri-apps/cli signer
  const env = { 
    ...process.env,
    TAURI_PRIVATE_KEY: privateKey,
    TAURI_KEY_PASSWORD: password,
    TAURI_SIGNING_PRIVATE_KEY: privateKey,
    TAURI_SIGNING_PRIVATE_KEY_PASSWORD: password
  };
  
  const output = execSync("pnpm dlx @tauri-apps/cli signer sign lifeOS.msi.zip", { env }).toString();
  console.log("Signer Output:\n", output);
  
  // Extract signature from output
  const match = output.match(/Signature:\s*([a-zA-Z0-9+/=]+)/i);
  if (match) {
    signature = match[1].trim();
  } else {
    // Fallback in case of exact match issues
    signature = output.trim();
  }
  console.log(`✅ Signature: ${signature}`);
} catch (err) {
  console.error("❌ Failed to sign lifeOS.msi.zip:", err);
  process.exit(1);
}

// 3. Generate updater.json
const date = new Date().toISOString();
const version = process.env.APP_VERSION || "1.0.0";

const updaterJson = {
  version: version,
  notes: `Rolling automated build for commit ${process.env.GITHUB_SHA || 'unknown'}`,
  pub_date: date,
  platforms: {
    "windows-x86_64": {
      signature: signature,
      url: "https://github.com/ghassanelgendy/lifeOS/releases/download/latest/lifeOS.msi.zip"
    }
  }
};

fs.writeFileSync("updater.json", JSON.stringify(updaterJson, null, 2), 'utf8');
console.log("✅ Created updater.json successfully!");
