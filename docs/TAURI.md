# lifeOS as a Windows desktop app (Tauri)

lifeOS can be packaged as a **Windows desktop app** using [Tauri 2](https://v2.tauri.app/). The built app runs **fully offline**: the UI and assets are embedded in the binary, and the app uses your existing local-first data (React Query persistence, SQLite where used) so it works without a network.

## Prerequisites

1. **Rust**  
   Install from [https://rustup.rs](https://rustup.rs). After installing, restart your terminal.

2. **Windows WebView2**  
   Usually already present on Windows 10/11. If the app fails to start, install the [WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/).

## Commands

- **Development (with hot reload):**  
  `npm run tauri:dev`  
  Starts the Vite dev server and opens the Tauri window.

- **Production build:**  
  `npm run tauri:build`  
  Builds the frontend, compiles the Rust app, and produces an installer under `src-tauri/target/release/bundle/` (e.g. NSIS `.exe` installer or MSI).

## Offline behavior

- The **app shell** (HTML, JS, CSS, assets) is embedded in the binary and served locally. No network is required to load the UI.
- **Supabase** requests (auth, tasks, etc.) will fail when offline; the app can show cached data from React Query persistence and handle offline queues as it does in the PWA.
- For a **fully offline** experience, use the app while signed in so data is cached, and rely on the existing offline/queue behavior for writes when the network is back.

## Project layout

- `src-tauri/` – Tauri (Rust) app: config, window, and build.
- `src-tauri/tauri.conf.json` – App ID, window size, and paths to the built frontend (`../dist`).
- `src-tauri/capabilities/default.json` – Permissions for the main window (e.g. shell to open links).
