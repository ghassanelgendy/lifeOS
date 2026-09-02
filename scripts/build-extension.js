import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const extDir = path.join(rootDir, 'extension');
const outZip = path.join(rootDir, 'lifeOS-extension.zip');

if (!fs.existsSync(path.join(extDir, 'manifest.json'))) {
  console.error(`❌ manifest.json not found in ${extDir}`);
  process.exit(1);
}

// Build a zip of the extension/ contents so the manifest.json sits at the
// top level once unpacked (ready for the browser's "Load unpacked" flow).
const isWin = process.platform === 'win32';

console.log('🤐 Zipping lifeOS browser extension...');
try {
  if (isWin) {
    // PowerShell Compress-Archive bundles the folder itself; stage contents.
    const staging = path.join(rootDir, '.extension-staging');
    fs.rmSync(staging, { recursive: true, force: true });
    fs.cpSync(extDir, staging, { recursive: true });
    execFileSync(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-Command', "Compress-Archive -Path '.extension-staging\\*' -DestinationPath 'lifeOS-extension.zip' -Force"],
      { cwd: rootDir, stdio: 'inherit' }
    );
    fs.rmSync(staging, { recursive: true, force: true });
  } else {
    // Run `zip` from a temp copy so the archive contains only top-level files.
    const staging = path.join(rootDir, '.extension-staging');
    fs.rmSync(staging, { recursive: true, force: true });
    fs.cpSync(extDir, staging, { recursive: true });
    execFileSync('zip', ['-r', '-q', '../lifeOS-extension.zip', '.', '-x', '*.DS_Store'], {
      cwd: staging,
      stdio: 'inherit',
    });
    fs.rmSync(staging, { recursive: true, force: true });
  }
} catch (err) {
  console.error('❌ Failed to zip extension:', err.message);
  process.exit(1);
}

console.log(`✅ Created ${outZip}`);
