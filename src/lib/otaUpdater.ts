import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';

const CURRENT_VERSION_KEY = 'lifeos_local_ota_version';
// We use the supabase URL defined in env variables
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const VERSION_URL = `${SUPABASE_URL}/storage/v1/object/public/app-updates/version.json`;

export async function checkAndApplyUpdates() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    // 1. Notify CapacitorUpdater that the app loaded successfully (prevents automatic rollback)
    await CapacitorUpdater.notifyAppReady();

    // Debug Alert to verify env vars are baked in
    alert(`OTA Debug: VITE_SUPABASE_URL = "${SUPABASE_URL}"`);

    if (!SUPABASE_URL) {
      alert('OTA Warning: VITE_SUPABASE_URL is empty! OTA updates are disabled.');
      return;
    }

    // 2. Fetch the version.json from Supabase Storage
    alert(`OTA Debug: Fetching from ${VERSION_URL}`);
    const response = await fetch(VERSION_URL, { cache: 'no-store' });
    if (!response.ok) {
      alert(`OTA Error: version.json returned HTTP ${response.status}`);
      return;
    }

    const latest = await response.json(); // e.g., { version: "1.0.42", url: "..." }
    const currentVersion = localStorage.getItem(CURRENT_VERSION_KEY) || '1.0.0';

    if (latest && latest.version && latest.url && latest.version !== currentVersion) {
      console.log(`New OTA update found: ${latest.version}. Downloading from ${latest.url}...`);
      
      // 3. Download the zip bundle
      const updateBundle = await CapacitorUpdater.download({
        url: latest.url,
        version: latest.version,
      });

      // 4. Set the new version as active, which reloads the webview
      await CapacitorUpdater.set(updateBundle);
      
      // 5. Save the updated version locally
      localStorage.setItem(CURRENT_VERSION_KEY, latest.version);
      
      console.log('OTA update applied successfully. Reloading App...');
    } else {
      console.log(`App is up-to-date. Current OTA version: ${currentVersion}`);
    }
  } catch (err) {
    alert(`OTA Exception: ${err instanceof Error ? err.message : String(err)}`);
    console.error('OTA Update check failed:', err);
  }
}
