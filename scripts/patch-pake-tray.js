// Patches the installed pake-cli's Rust source so the desktop build ships a
// working runtime tray/AppIndicator toggle. Upstream pake-cli only builds the
// system tray once at startup from the build-time --show-system-tray flag —
// the Settings "Desktop System Tray & App Indicator" switch had nothing to
// call, so it never did anything. This adds a `set_tray_visible` Tauri
// command that reuses the same tray-builder logic on demand, and gives the
// tray icon a fixed id so repeated calls actually replace the old icon
// instead of leaving orphaned AppIndicator registrations behind.
//
// Runs after `pake-cli` is installed (see package.json / build-desktop.yml)
// and before `pake` builds the app, mirroring patch-pake-config.js's
// candidate-path discovery. Idempotent: safe to run against an
// already-patched source tree.
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

function findPakeCliSrcTauri() {
  let globalNodeModules = '';
  try {
    globalNodeModules = execSync('npm root -g').toString().trim();
  } catch {}

  const candidates = [
    globalNodeModules ? path.join(globalNodeModules, 'pake-cli', 'src-tauri') : '',
    '/usr/local/lib/node_modules/pake-cli/src-tauri',
    '/usr/lib/node_modules/pake-cli/src-tauri',
    path.join(process.cwd(), 'node_modules', 'pake-cli', 'src-tauri'),
  ].filter(Boolean);

  try {
    const pnpmDir = path.join(process.cwd(), 'node_modules', '.pnpm');
    if (fs.existsSync(pnpmDir)) {
      for (const entry of fs.readdirSync(pnpmDir)) {
        if (entry.startsWith('pake-cli@')) {
          candidates.push(path.join(pnpmDir, entry, 'node_modules', 'pake-cli', 'src-tauri'));
        }
      }
    }
  } catch {}

  return candidates.find((p) => fs.existsSync(path.join(p, 'src', 'lib.rs')));
}

function replaceOnce(filePath, from, to, label) {
  const original = fs.readFileSync(filePath, 'utf8');
  if (original.includes(to)) {
    console.log(`ℹ️ ${label}: already patched, skipping.`);
    return;
  }
  if (!original.includes(from)) {
    throw new Error(`${label}: expected text not found in ${filePath} (pake-cli version may have changed).`);
  }
  fs.writeFileSync(filePath, original.replace(from, to), 'utf8');
  console.log(`✅ ${label}`);
}

try {
  const srcTauri = findPakeCliSrcTauri();
  if (!srcTauri) {
    console.warn('⚠️ Could not locate an installed pake-cli src-tauri directory; skipping tray patch.');
    process.exit(0);
  }

  const invokeRs = path.join(srcTauri, 'src', 'app', 'invoke.rs');
  const setupRs = path.join(srcTauri, 'src', 'app', 'setup.rs');
  const libRs = path.join(srcTauri, 'src', 'lib.rs');

  // 1. Give the tray a fixed id so remove_tray_by_id("pake-tray") actually
  //    matches a previously-built tray instead of a new random id each call.
  replaceOnce(
    setupRs,
    'let mut tray_builder = TrayIconBuilder::new()\n        .menu(&menu)',
    'let mut tray_builder = TrayIconBuilder::with_id("pake-tray")\n        .menu(&menu)',
    'setup.rs: fixed tray id'
  );

  // 2. Add the set_tray_visible command.
  replaceOnce(
    invokeRs,
    '#[command]\npub fn set_dock_badge(app: AppHandle, count: Option<i64>) -> Result<(), String> {',
    `/// Runtime tray/AppIndicator show-hide toggle. \`set_system_tray\` at startup
/// only runs once from the build-time --show-system-tray flag; this lets the
/// Settings toggle call back into the same builder logic on demand.
#[command]
pub fn set_tray_visible(app: AppHandle, visible: bool) -> Result<(), String> {
    use crate::app::setup::set_system_tray;
    use crate::app::window::MultiWindowState;
    use std::sync::{atomic::AtomicBool, Arc};

    let state = app.state::<MultiWindowState>();
    let pake_config = state.pake_config.clone();
    let init_fullscreen = pake_config.windows[0].fullscreen;
    let multi_window = pake_config.multi_window;
    let tray_icon_path = pake_config.system_tray_path.clone();
    drop(state);

    set_system_tray(
        &app,
        visible,
        &tray_icon_path,
        init_fullscreen,
        multi_window,
        Arc::new(AtomicBool::new(true)),
    )
    .map_err(|e| format!("Failed to update tray visibility: {e}"))
}

#[command]
pub fn set_dock_badge(app: AppHandle, count: Option<i64>) -> Result<(), String> {`,
    'invoke.rs: added set_tray_visible command'
  );

  // 3. Import + register the new command.
  replaceOnce(
    libRs,
    `    invoke::{
        clear_dock_badge, download_file, increment_dock_badge, send_notification, set_dock_badge,
        set_dock_badge_label, set_zoom, update_theme_mode, webview_navigate,
    },`,
    `    invoke::{
        clear_dock_badge, download_file, increment_dock_badge, send_notification, set_dock_badge,
        set_dock_badge_label, set_tray_visible, set_zoom, update_theme_mode, webview_navigate,
    },`,
    'lib.rs: imported set_tray_visible'
  );
  replaceOnce(
    libRs,
    `            set_zoom,
            webview_navigate,
        ])`,
    `            set_zoom,
            webview_navigate,
            set_tray_visible,
        ])`,
    'lib.rs: registered set_tray_visible'
  );

  console.log('✅ pake-cli tray patch applied.');
} catch (err) {
  console.error('❌ Failed to patch pake-cli for tray support:', err);
  process.exit(1);
}
