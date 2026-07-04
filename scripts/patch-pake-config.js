import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

try {
  const globalNodeModules = execSync('npm root -g').toString().trim();
  const tauriConfPath = path.join(globalNodeModules, 'pake-cli', 'src-tauri', 'tauri.conf.json');

  if (!fs.existsSync(tauriConfPath)) {
    console.error(`❌ Could not find Pake tauri.conf.json at: ${tauriConfPath}`);
    process.exit(1);
  }

  const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));

  // Enable updater config
  tauriConf.tauri = tauriConf.tauri || {};
  tauriConf.tauri.updater = {
    active: true,
    endpoints: [
      "https://github.com/ghassanelgendy/lifeOS/releases/download/latest/updater.json"
    ],
    dialog: true,
    pubkey: process.env.TAURI_PUBLIC_KEY || ""
  };

  fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2), 'utf8');
  console.log(`✅ Patched Pake tauri.conf.json at ${tauriConfPath} successfully with updater endpoint and public key.`);
} catch (err) {
  console.error("❌ Failed to patch Pake config:", err);
  process.exit(1);
}
