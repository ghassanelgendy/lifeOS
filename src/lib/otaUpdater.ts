import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { addSystemLog } from './logger';
import packageJson from '../../package.json';

const CURRENT_VERSION_KEY = 'lifeos_local_ota_version';
// We use the supabase URL defined in env variables
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const VERSION_URL = `${SUPABASE_URL}/storage/v1/object/public/app-updates/version.json`;

function resolveOtaBundleUrl(url: string): string | null {
  const raw = url.trim();
  if (!raw) return null;

  try {
    return new URL(raw, VERSION_URL).toString();
  } catch {
    return null;
  }
}

export async function checkAndApplyUpdates() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    // 1. Notify CapacitorUpdater that the app loaded successfully (prevents automatic rollback)
    await CapacitorUpdater.notifyAppReady();

    addSystemLog(`OTA check: VITE_SUPABASE_URL = "${SUPABASE_URL}"`, 'info');

    if (!SUPABASE_URL) {
      addSystemLog('OTA check: VITE_SUPABASE_URL is empty! OTA updates are disabled.', 'warn');
      return;
    }

    // 2. Fetch the version.json from Supabase Storage
    addSystemLog(`OTA check: Fetching from ${VERSION_URL}`, 'info');
    const response = await fetch(VERSION_URL, { cache: 'no-store' });
    if (!response.ok) {
      addSystemLog(`OTA check: version.json returned HTTP ${response.status}`, 'error');
      return;
    }

    const latest = await response.json();
    const currentVersion = localStorage.getItem(CURRENT_VERSION_KEY) || packageJson.version;
    addSystemLog(`OTA check: Latest version = ${latest?.version}, Local version = ${currentVersion}`, 'info');

    if (latest && latest.version && latest.url && latest.version !== currentVersion) {
      const bundleUrl = resolveOtaBundleUrl(latest.url);
      if (!bundleUrl) {
        addSystemLog(`OTA check: Invalid bundle URL in manifest: ${String(latest.url)}`, 'error');
        return;
      }

      addSystemLog(`OTA check: New update found (${latest.version}). Downloading...`, 'info');
      
      // 3. Download the zip bundle
      const updateBundle = await CapacitorUpdater.download({
        url: bundleUrl,
        version: latest.version,
      });
      addSystemLog(`OTA check: Download completed. Setting active bundle...`, 'info');

      // 4. Set the new version as active, which reloads the webview
      await CapacitorUpdater.set({ id: updateBundle.id });
      
      // 5. Save the updated version locally
      localStorage.setItem(CURRENT_VERSION_KEY, latest.version);
      addSystemLog('OTA check: Update applied successfully. WebView reloading...', 'info');
    } else {
      addSystemLog(`OTA check: App is up-to-date. (Version: ${currentVersion})`, 'info');
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? `${err.name}: ${err.message}\n${err.stack || ''}` : String(err);
    addSystemLog(`OTA check exception: ${errorMsg}`, 'error');
    console.error('OTA Update check failed:', err);
  }
}
