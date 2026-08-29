import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

try {
  let globalNodeModules = '';
  try {
    globalNodeModules = execSync('npm root -g').toString().trim();
  } catch {}

  const candidatePaths = [
    globalNodeModules ? path.join(globalNodeModules, 'pake-cli', 'src-tauri', 'tauri.conf.json') : '',
    globalNodeModules ? path.join(globalNodeModules, 'pake-cli', 'tauri.conf.json') : '',
    '/usr/local/lib/node_modules/pake-cli/src-tauri/tauri.conf.json',
    '/usr/lib/node_modules/pake-cli/src-tauri/tauri.conf.json',
    path.join(process.cwd(), 'node_modules', 'pake-cli', 'src-tauri', 'tauri.conf.json'),
  ].filter(Boolean);

  // Also try searching in .pnpm directory if present
  try {
    const pnpmDir = path.join(process.cwd(), 'node_modules', '.pnpm');
    if (fs.existsSync(pnpmDir)) {
      const entries = fs.readdirSync(pnpmDir);
      for (const entry of entries) {
        if (entry.startsWith('pake-cli@')) {
          candidatePaths.push(path.join(pnpmDir, entry, 'node_modules', 'pake-cli', 'src-tauri', 'tauri.conf.json'));
        }
      }
    }
  } catch {}

  let tauriConfPath = candidatePaths.find((p) => p && fs.existsSync(p));

  const pubkey = process.env.TAURI_PUBLIC_KEY || '';
  const version = process.env.APP_VERSION || '1.0.0';

  if (!tauriConfPath) {
    console.warn(`⚠️ Could not locate Pake tauri.conf.json in candidate paths:`);
    candidatePaths.forEach((p) => console.warn(`   - ${p}`));
    if (!pubkey) {
      console.log('ℹ️ TAURI_PUBLIC_KEY is not set. Skipping Pake config patch without error.');
      process.exit(0);
    } else {
      console.error('❌ TAURI_PUBLIC_KEY is required but tauri.conf.json could not be found.');
      process.exit(1);
    }
  }

  const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));

  // Determine Tauri version from config structure
  const isTauriV2 = !tauriConf.tauri && (tauriConf.productName || tauriConf.identifier);

  if (isTauriV2) {
    if (pubkey) {
      tauriConf.plugins = tauriConf.plugins || {};
      tauriConf.plugins.updater = {
        active: true,
        endpoints: [
          'https://github.com/ghassanelgendy/lifeOS/releases/latest/download/updater.json',
        ],
        dialog: true,
        pubkey,
      };
    }
    if (version) tauriConf.version = version;
  } else {
    if (pubkey) {
      tauriConf.tauri = tauriConf.tauri || {};
      tauriConf.tauri.updater = {
        active: true,
        endpoints: [
          'https://github.com/ghassanelgendy/lifeOS/releases/latest/download/updater.json',
        ],
        dialog: true,
        pubkey,
      };
    }
  }

  try {
    fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2), 'utf8');
  } catch (writeErr) {
    if (writeErr && writeErr.code === 'EACCES') {
      const tempPath = path.join('/tmp', 'tauri.conf.json');
      fs.writeFileSync(tempPath, JSON.stringify(tauriConf, null, 2), 'utf8');
      try {
        execSync(`sudo cp "${tempPath}" "${tauriConfPath}"`);
      } catch {
        execSync(`sudo chown -R $(id -un):$(id -gn) "${path.dirname(tauriConfPath)}" && cp "${tempPath}" "${tauriConfPath}"`);
      }
    } else {
      throw writeErr;
    }
  }
  const schemaVersion = isTauriV2 ? 'v2' : 'v1';
  console.log(`✅ Patched Pake tauri.conf.json (Tauri ${schemaVersion}) at ${tauriConfPath}`);
  if (pubkey) console.log(`   Updater endpoint: releases/latest/download/updater.json`);
} catch (err) {
  console.error('❌ Failed to patch Pake config:', err);
  process.exit(1);
}
