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
  const pubkey = process.env.TAURI_PUBLIC_KEY || '';
  const version = process.env.APP_VERSION || '1.0.0';

  // Determine Tauri version from config structure
  // Tauri v2: top-level keys are "productName", "version", "identifier", "plugins", etc.
  // Tauri v1: top-level key is "tauri" (which wraps everything)
  const isTauriV2 = !tauriConf.tauri && (tauriConf.productName || tauriConf.identifier);

  if (isTauriV2) {
    // Tauri v2 updater plugin config
    tauriConf.plugins = tauriConf.plugins || {};
    tauriConf.plugins.updater = {
      active: true,
      endpoints: [
        'https://github.com/ghassanelgendy/lifeOS/releases/latest/download/updater.json'
      ],
      dialog: true,
      pubkey
    };
    // Set version
    if (version) tauriConf.version = version;
  } else {
    // Tauri v1 updater config (legacy path)
    tauriConf.tauri = tauriConf.tauri || {};
    tauriConf.tauri.updater = {
      active: true,
      endpoints: [
        'https://github.com/ghassanelgendy/lifeOS/releases/latest/download/updater.json'
      ],
      dialog: true,
      pubkey
    };
  }

  fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2), 'utf8');
  const schemaVersion = isTauriV2 ? 'v2' : 'v1';
  console.log(`✅ Patched Pake tauri.conf.json (Tauri ${schemaVersion}) at ${tauriConfPath}`);
  console.log(`   Updater endpoint: releases/latest/download/updater.json`);
} catch (err) {
  console.error('❌ Failed to patch Pake config:', err);
  process.exit(1);
}
