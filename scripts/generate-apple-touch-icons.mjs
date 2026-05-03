/**
 * Generates 180x180 apple-touch-icon.png from each route folder's favicon.svg.
 * Run: node scripts/generate-apple-touch-icons.mjs
 * Requires: npm install -D sharp
 */
import { readFile, writeFile, access } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const ROUTE_FOLDERS = ['todo', 'habits', 'calendar', 'screentime', 'sleep'];
const SIZE = 180;

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch (e) {
    console.error('Install sharp first: npm install -D sharp');
    process.exit(1);
  }

  for (const folder of ROUTE_FOLDERS) {
    const svgPath = join(ROOT, 'public', folder, 'favicon.svg');
    const pngPath = join(ROOT, 'public', folder, 'apple-touch-icon.png');
    if (!(await exists(svgPath))) {
      console.warn('Skip %s: no favicon.svg', folder);
      continue;
    }
    try {
      const svg = await readFile(svgPath);
      await sharp(svg)
        .resize(SIZE, SIZE)
        .png()
        .toFile(pngPath);
      console.log('OK %s -> apple-touch-icon.png', folder);
    } catch (err) {
      console.error('Error %s:', folder, err.message);
    }
  }
}

main();
