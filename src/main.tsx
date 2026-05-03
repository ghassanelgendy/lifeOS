import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const UI_STORAGE_KEY = 'lifeos-ui-store'

// When running in Tauri, add a class, center window, and optionally start minimized
async function detectTauri() {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    const win = getCurrentWindow()
    document.documentElement.classList.add('tauri')

    // Always center the window on startup
    await win.center()

    // Start minimized if user preference is set (read from persisted store)
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(UI_STORAGE_KEY) : null
      const parsed = raw ? (JSON.parse(raw) as { state?: { tauriStartMinimized?: boolean } }) : null
      if (parsed?.state?.tauriStartMinimized) {
        await win.minimize()
      }
    } catch {
      // ignore
    }

    // Defensive cleanup: old PWA service workers/caches can keep stale assets in desktop webview.
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map((r) => r.unregister()))
      }
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
      }
    } catch {
      // ignore cache cleanup failures
    }
  } catch {
    // not in Tauri
  }
}
detectTauri()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
