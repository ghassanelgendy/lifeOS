import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// When running in Tauri, add a class so CSS can hide the custom title bar and use native only
async function detectTauri() {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    await getCurrentWindow()
    document.documentElement.classList.add('tauri')
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
