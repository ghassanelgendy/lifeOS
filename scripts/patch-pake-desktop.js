// Patches the installed pake-cli's Rust source for a handful of desktop
// (mainly Linux) fixes that need to live upstream of the JS/CSS layer:
//
// 1. A working runtime tray/AppIndicator toggle — pake-cli only builds the
//    system tray once at startup from the build-time --show-system-tray
//    flag, so the Settings "Desktop System Tray & App Indicator" switch had
//    nothing to call. Adds a `set_tray_visible` command that reuses the same
//    tray-builder logic on demand, and gives the tray icon a fixed id so
//    repeated calls actually replace the old icon instead of leaving
//    orphaned AppIndicator registrations behind.
// 2. tauri-plugin-window-state restoring a *previous* build's cached
//    `decorated` value on every launch, silently undoing whatever this
//    build's --hide-window-decorations was actually set to (the exact class
//    of bug pake-cli already works around for StateFlags::FULLSCREEN, just
//    not for DECORATIONS) — this is what made the custom Linux title bar
//    appear stacked under a second, non-functional native one.
// 3. A `get_gnome_button_layout` command plus a `gsettings monitor` watcher
//    thread, so the Linux-only custom title bar (native decorations are
//    hidden there) can mirror the user's button-layout gsetting instead of
//    hard-coding a right-aligned Windows/macOS-style row.
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
            get_gnome_button_layout,
        ])`,
    'lib.rs: registered set_tray_visible + get_gnome_button_layout'
  );

  // 4. Stop tauri-plugin-window-state from restoring a stale `decorated`
  //    value across builds/upgrades (same class of bug already worked
  //    around for StateFlags::FULLSCREEN just above it).
  replaceOnce(
    libRs,
    `            // Prevent flickering on the first open.
            // Exclude FULLSCREEN so a prior --fullscreen build's persisted state
            // doesn't force fullscreen on a rebuild without --fullscreen.
            StateFlags::all() & !StateFlags::VISIBLE & !StateFlags::FULLSCREEN`,
    `            // Prevent flickering on the first open.
            // Exclude FULLSCREEN so a prior --fullscreen build's persisted state
            // doesn't force fullscreen on a rebuild without --fullscreen.
            // Exclude DECORATIONS for the same reason: a prior build's cached
            // \`decorated\` value otherwise gets reapplied via set_decorations()
            // on every launch, silently undoing this build's
            // --hide-window-decorations (or lack thereof) — decorations should
            // be fully determined by how the app was packaged, not remembered
            // per-user across upgrades.
            StateFlags::all() & !StateFlags::VISIBLE & !StateFlags::FULLSCREEN & !StateFlags::DECORATIONS`,
    'lib.rs: stopped window-state restoring a stale decorated flag'
  );

  // 5. Add the get_gnome_button_layout command.
  replaceOnce(
    invokeRs,
    `/// Runtime tray/AppIndicator show-hide toggle. \`set_system_tray\` at startup`,
    `/// Read GNOME's window-control button placement/order so the Linux-only
/// custom title bar (native decorations are hidden there — see
/// --hide-window-decorations) can mirror the user's \`button-layout\` gsetting
/// (e.g. "close,minimize,maximize:" for close/min/max on the left) instead of
/// hard-coding a right-aligned, Windows/macOS-style layout regardless of the
/// desktop environment's own setting.
#[command]
pub fn get_gnome_button_layout() -> Result<String, String> {
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("gsettings")
            .args(["get", "org.gnome.desktop.wm.preferences", "button-layout"])
            .output()
            .map_err(|e| format!("Failed to run gsettings: {e}"))
            .map(|out| {
                String::from_utf8_lossy(&out.stdout)
                    .trim()
                    .trim_matches('\\'')
                    .to_string()
            })
    }
    #[cfg(not(target_os = "linux"))]
    {
        Ok(String::new())
    }
}

/// Runtime tray/AppIndicator show-hide toggle. \`set_system_tray\` at startup`,
    'invoke.rs: added get_gnome_button_layout command'
  );

  // 6. Add the gsettings-monitor background thread that keeps the title bar
  //    layout live.
  replaceOnce(
    libRs,
    `            app.manage(MultiWindowState::new(
                pake_config.clone(),
                tauri_config.clone(),
            ));

            // --- Menu Construction Start ---`,
    `            app.manage(MultiWindowState::new(
                pake_config.clone(),
                tauri_config.clone(),
            ));

            // Let the Linux-only custom title bar follow the user's GNOME
            // button layout (left/right, order) live instead of only reading
            // it once at launch — \`gsettings monitor\` blocks on stdout until
            // the value changes, so this thread just re-emits whenever that
            // happens.
            #[cfg(target_os = "linux")]
            {
                use std::io::{BufRead, BufReader};
                use std::process::{Command, Stdio};
                use tauri::Emitter;

                let monitor_handle = app.app_handle().clone();
                std::thread::spawn(move || {
                    let child = Command::new("gsettings")
                        .args([
                            "monitor",
                            "org.gnome.desktop.wm.preferences",
                            "button-layout",
                        ])
                        .stdout(Stdio::piped())
                        .spawn();
                    let Ok(mut child) = child else { return };
                    let Some(stdout) = child.stdout.take() else { return };
                    for line in BufReader::new(stdout).lines().map_while(Result::ok) {
                        // Lines look like: button-layout: 'close,minimize,maximize:'
                        if let Some((_, value)) = line.split_once(": ") {
                            let value = value.trim().trim_matches('\\'').to_string();
                            let _ = monitor_handle.emit("gnome-button-layout-changed", value);
                        }
                    }
                });
            }

            // --- Menu Construction Start ---`,
    'lib.rs: added gsettings-monitor thread for the title bar'
  );

  console.log('✅ pake-cli desktop patch applied.');
} catch (err) {
  console.error('❌ Failed to patch pake-cli for desktop support:', err);
  process.exit(1);
}
