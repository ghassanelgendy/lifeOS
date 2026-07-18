import fs from 'fs';

const ENHANCEMENTS = new Map();

ENHANCEMENTS.set('### .gitattributes', `### .gitattributes

**File Purpose:** Git configuration file that enforces line ending normalization for shell scripts.

**Functions & Classes:** None (configuration file)

**Function Details:**
- \`*.sh text eol=lf\` — Forces all \`.sh\` files to use LF line endings regardless of the operating system, ensuring shell scripts execute correctly on Unix-like systems.

---`);

ENHANCEMENTS.set('### .gitignore', `### .gitignore

**File Purpose:** Specifies intentionally untracked files and directories that Git should ignore.

**Functions & Classes:** None (configuration file)

**Function Details:**
- Excludes standard development artifacts: \`node_modules\`, \`dist\`, \`dist-ssr\`, \`.env\`, editor files (\`.vscode\`, \`.idea\`), and OS files (\`.DS_Store\`).
- Ignores build outputs: \`/dist-electron\`, \`/release\`, \`/src-tauri/target\`.
- Excludes iOS 6 lite auto-login secrets and cache directories.
- Ignores Supabase temporary files and SQL dumps to prevent credential leaks.
- Excludes log files and local environment configurations (\`*.local\`).

---`);

ENHANCEMENTS.set('### .npmrc', `### .npmrc

**File Purpose:** NPM/PNPM package manager configuration for the workspace.

**Functions & Classes:** None (configuration file)

**Function Details:**
- \`auto-install-peers=false\` — Prevents automatic installation of peer dependencies.
- \`strict-peer-dependencies=false\` — Allows installation even when peer dependency versions don't match exactly.
- \`resolution-mode=highest\` — Prefers the highest compatible version when resolving dependencies.
- \`minimum-release-age=0\` — Allows installation of packages immediately upon release without waiting.

---`);

ENHANCEMENTS.set('### capacitor.config.ts', `### capacitor.config.ts

**File Purpose:** Capacitor configuration for cross-platform mobile app runtime (iOS/Android hybrid app wrapper).

**Functions & Classes:**
- \`config\` (object)

**Function Details:**
- \`config.appId\` (\`'com.ghassanelgendy.lifeos'\`) — Unique bundle identifier for the mobile application.
- \`config.appName\` (\`'lifeOS'\`) — Display name of the application on the device.
- \`config.webDir\` (\`'dist'\`) — Directory containing the built web assets to be wrapped.
- \`config.server.androidScheme\` / \`config.server.iosScheme\` (\`'https'\`) — URL scheme for serving the web content inside the native WebView.
- \`config.plugins.App.urlScheme\` (\`'lifeos'\`) — Custom deep link URL scheme (\`lifeos://\`) for opening the app from external links.
- \`config.plugins.CapacitorUpdater.autoUpdate\` (\`false\`) — Disables automatic Over-The-Air updates; updates are managed manually.
- \`config.plugins.SplashScreen\` — Configures the native splash screen with dark background (\`#09090b\`), no spinner, and auto-hide.
- \`config.plugins.Keyboard\` — Sets keyboard style to dark, disables webview resizing (\`resize: "none"\`), and prevents full-screen resize behavior.

---`);

ENHANCEMENTS.set('### codemagic.yaml', `### codemagic.yaml

**File Purpose:** CI/CD pipeline configuration for automated iOS builds on Codemagic.

**Functions & Classes:** None (YAML configuration)

**Function Details:**
- \`workflows.ios-build\` — Defines the iOS unsigned build workflow.
- \`max_build_duration: 30\` — 30-minute timeout limit.
- \`instance_type: mac_mini_m1\` — Builds on an Apple Silicon M1 Mac mini.
- \`triggering\` — Triggers on pushes to the \`main\` branch.
- \`when.changeset\` — Skips builds unless changes are detected in \`ios/**\`, \`android/**\`, \`capacitor.config.*\`, \`package.json\`, or \`codemagic.yaml\`.
- Build steps:
  1. Dependencies: \`npm install -g pnpm && pnpm install\`
  2. Web build: \`pnpm build:ios\`
  3. Capacitor sync: \`pnpm cap add ios || true && pnpm cap sync ios\`
  4. iOS compilation: \`xcodebuild\` with \`CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO\`
  5. Packaging: Creates \`lifeOS.ipa\` from the compiled \`.app\` bundle.
- \`artifacts\` — Outputs \`build/ios/*.ipa\` files.

---`);

ENHANCEMENTS.set('### eslint.config.js', `### eslint.config.js

**File Purpose:** ESLint flat config for TypeScript, React, and React Hooks linting. Defines code quality rules for the project.

**Functions & Classes:** None (configuration export)

**Function Details:**
- \`globalIgnores\` — Ignores \`dist\`, \`src-tauri/**\`, and \`.lifeos-cache/**\` from linting.
- Extends recommended configs: \`@eslint/js\`, \`typescript-eslint\`, \`eslint-plugin-react-hooks\`, \`eslint-plugin-react-refresh\`.
- Targets files: \`**/*.{ts,tsx}\`.
- Disabled rules (mid-migration to stricter standards): \`@typescript-eslint/no-explicit-any\`, \`react-hooks/refs\`, \`react-hooks/set-state-in-effect\`, \`react-refresh/only-export-components\`, etc.
- Warnings: \`@typescript-eslint/no-unused-vars\` (ignores underscore-prefixed identifiers).
- Language options: ECMAScript 2020 with browser globals.

---`);

ENHANCEMENTS.set('### index.html', `### index.html

**File Purpose:** HTML entry point for the SPA. Contains critical inline script for FOUC-free theme initialization (reads saved theme/accent from localStorage before DOM paint) and PWA meta tags.

**Functions & Classes:** None (HTML template)

**Function Details:**
- Inline IIFE script (lines 5-25): Reads \`lifeos-ui-store\` from localStorage, extracts \`theme\` and \`accentTheme\`, applies them to \`<html>\` class and data-attribute immediately. Prevents flash of unstyled content.
- Viewport meta tag: Sets \`width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover\` — locks zoom, supports iOS safe area insets.
- Favicon & icons: SVG, PNG 96x96, ICO, Apple Touch Icon (192x192), and web app manifest links.
- PWA meta tags: \`apple-mobile-web-app-title\`, \`mobile-web-app-capable\`, \`apple-mobile-web-app-status-bar-style: default\`.
- Title: "lifeOS".
- Root mount point: \`<div id="root"></div>\`.
- Module script: \`/src/main.tsx\` (Vite entry).

---`);

ENHANCEMENTS.set('### knip.json', `### knip.json

**File Purpose:** Knip configuration for dead code detection and unused dependency analysis.

**Functions & Classes:** None (configuration file)

**Function Details:**
- \`ignore\` — Excludes \`dist/**\`, \`dev-dist/**\`, \`node_modules/**\`, \`.lifeos-cache/**\`, and \`lifeos-agent-cli/**\`.
- \`entry\` — Defines application entry points: \`index.html\`, \`src/main.tsx\`, \`src/App.tsx\`, \`src/sw.ts\`, all \`api/**/*.ts\` files, and all Supabase Edge Function entry points.
- \`project\` — Scopes analysis to \`src/**/*.{ts,tsx}\`, \`api/**/*.ts\`, and \`supabase/functions/**/*.{ts,tsx}\`.

---`);

ENHANCEMENTS.set('### package.json', `### package.json

**File Purpose:** Workspace root package manifest. Defines scripts, dependencies, dev dependencies, engine requirements, and PNPM workspace settings.

**Functions & Classes:** None (configuration file)

**Function Details:**
- \`"name": "lifeos-workspace"\`, \`"private": true\`, \`"type": "module"\`, \`"packageManager": "pnpm@10.18.0"\`.
- Engines: Node \`>=20.9.0\`, PNPM \`>=10\`.
- Key scripts:
  - \`dev\` / \`dev:ios\` / \`dev:pake\` — Vite dev server with platform modes.
  - \`build\` / \`build:ios\` / \`build:pake\` — Production builds.
  - \`pake:local\` — Desktop app build using Pake CLI (Windows-specific with \`copy\` command).
  - \`lint\` — ESLint on \`src\`.
  - \`test\` / \`test:watch\` — Vitest (run/watch).
  - \`typecheck\` — TypeScript noEmit check.
- Key dependencies: React 19, React Router DOM, Zustand, React Query, Supabase, Recharts, date-fns, Adhan (prayer times), Lucide React, Framer Motion, Zod, uuid, Tailwind merge, clsx.
- Key dev dependencies: Vite 8, Vitest, TypeScript 6, ESLint 10, Tailwind CSS v4, @vitejs/plugin-react, @vitejs/plugin-legacy, vite-plugin-pwa, Pake CLI, Sharp, jsdom.
- PNPM architectures: Supported OS (current, darwin, linux, win32) and CPU (current, x64, arm64).

---`);

ENHANCEMENTS.set('### pnpm-workspace.yaml', `### pnpm-workspace.yaml

**File Purpose:** PNPM workspace definition. Declares monorepo packages, shared dependency catalog versions, release policy, and native binary exclusions.

**Functions & Classes:** None (configuration file)

**Function Details:**
- Packages: \`lib/*\`, \`lib/integrations/*\`, \`scripts\`.
- \`autoInstallPeers: false\`.
- \`catalog\` — Defines shared dependency versions across the workspace: Tailwind CSS, React, TypeScript, Drizzle ORM, Framer Motion, Vite, Zod, etc.
- \`minimumReleaseAge: 1440\` — 24-hour delay before installing new releases.
- \`minimumReleaseAgeExclude\` — Replit packages, stripe-replit-sync, pake-cli, and Tauri packages excluded from release age restriction.
- \`onlyBuiltDependencies\` — \`@swc/core\`, \`esbuild\`, \`msw\`, \`unrs-resolver\` require building from source.
- \`overrides\` — Extensive list of native binary exclusions (replaced with \`'-'\`) for Ngrok, Tailwind CSS Oxide, esbuild, Lightning CSS, and Rollup. Pins esbuild to \`0.27.3\`.

---`);

ENHANCEMENTS.set('### postcss.config.js', `### postcss.config.js

**File Purpose:** PostCSS configuration for processing CSS in the build pipeline.

**Functions & Classes:** None (configuration file)

**Function Details:**
- Single plugin: \`@tailwindcss/postcss\` — Enables Tailwind CSS v4 PostCSS integration for processing utility classes and @theme rules.

---`);

ENHANCEMENTS.set('### tsconfig.json', `### tsconfig.json

**File Purpose:** TypeScript project references root. Delegates to separate tsconfig files for app and node contexts.

**Functions & Classes:** None (configuration file)

**Function Details:**
- \`"files": []\` — No files at root level; uses project references.
- References: \`./tsconfig.app.json\` (browser/frontend code) and \`./tsconfig.node.json\` (Node.js tooling config).

---`);

ENHANCEMENTS.set('### tsconfig.base.json', `### tsconfig.base.json

**File Purpose:** Shared TypeScript compiler options base configuration extended by other tsconfig files.

**Functions & Classes:** None (configuration file)

**Function Details:**
- \`isolatedModules: true\` — Ensures each file can be transpiled independently (required for Babel/swc).
- Targets ES2022 with \`bundler\` module resolution.
- Strict type checking enabled: \`strictNullChecks\`, \`strictBindCallApply\`, \`strictPropertyInitialization\`, \`noImplicitAny\`, \`noImplicitThis\`, \`alwaysStrict\`.
- \`strictFunctionTypes: false\` — Relaxed for compatibility.
- \`noImplicitOverride: false\`, \`noUnusedLocals: false\`.
- \`customConditions\`: \`["workspace"]\` — Custom import conditions for workspace resolution.
- \`skipLibCheck: true\` — Skips type checking of declaration files.

---`);

ENHANCEMENTS.set('### tsconfig.app.json', `### tsconfig.app.json

**File Purpose:** TypeScript configuration for the browser application code. Manages bundler mode, JSX, and path aliases.

**Functions & Classes:** None (configuration file)

**Function Details:**
- Target: ES2022 with DOM, DOM.Iterable, WebWorker libs.
- Module: ESNext with \`bundler\` resolution.
- Types: \`vite/client\`.
- JSX: \`react-jsx\` — automatic JSX runtime.
- Strict linting: \`strict: true\`, \`noUnusedLocals\`, \`noUnusedParameters\`, \`erasableSyntaxOnly\`, \`noUncheckedSideEffectImports\`.
- Path aliases:
  - \`@/*\` → \`./src/*\`
  - Multiple \`*.platform\` → fallback chain (pake → web) with explicit path mappings for hooks, components, UI, dashboard, and routes directories.
- Includes \`src\` directory. Excludes \`src/db\`, \`**/*.test.ts\`, \`src/sw.ts\`.

---`);

ENHANCEMENTS.set('### tsconfig.node.json', `### tsconfig.node.json

**File Purpose:** TypeScript configuration for Node.js tooling (build scripts, configuration files).

**Functions & Classes:** None (configuration file)

**Function Details:**
- Target: ES2023 with ES2023 lib.
- Module: ESNext with \`bundler\` resolution.
- Types: \`node\`.
- Strict linting: same rules as tsconfig.app.json.
- Includes: \`vite.config.ts\` only.

---`);

ENHANCEMENTS.set('### vercel.json', `### vercel.json

**File Purpose:** Vercel deployment configuration for the frontend SPA and API routes.

**Functions & Classes:** None (configuration file)

**Function Details:**
- \`installCommand\`: \`pnpm install --frozen-lockfile\`.
- \`buildCommand\`: \`pnpm build\`.
- \`outputDirectory\`: \`dist\`.
- \`rewrites\`: SPA fallback — all paths except \`/api/*\` serve \`index.html\`, enabling client-side routing.

---`);

ENHANCEMENTS.set('### vite.config.ts', `### vite.config.ts

**File Purpose:** Vite build configuration with multi-platform support (web, iOS, pake), custom platform-resolution plugin, development API proxy, and PWA integration.

**Functions & Classes:**
- \`platformResolvePlugin\` (function → Vite Plugin)

**Function Details:**
- \`platformResolvePlugin(platform)\` — Custom enforce-pre Vite plugin that resolves \`*.platform\` imports and \`index.css\` to platform-specific variants:
  - Maps \`.platform\` to \`.ios\`, \`.web\`, or \`.pake\`.
  - For Pake: falls back to \`.web\` if no \`.pake.tsx\` file exists.
  - Similarly resolves \`index.css\` to \`index.ios.css\`, \`index.web.css\`, or \`index.pake.css\`.
- Config factory (mode-dependent):
  - Platform detection: \`mode === 'ios' ? 'ios' : mode === 'pake' ? 'pake' : 'web'\`.
  - \`base\`: \`'./'\` for pake (desktop), \`'/'\` for web.
  - Build target: \`safari13\` by default, \`es5\` for iOS 6 legacy mode.
- Plugins:
  - \`devApiProxyPlugin\` — Development server middleware:
    - Proxies \`/api/calendar/tasks\` to the local API handler.
    - Proxies \`/api/proxy\` for external URL fetching (webcal→https normalization, User-Agent header).
  - \`ignoreApiPlugin\` — Stubs out \`api/*\` imports during Vite bundling (prevents esbuild errors on serverless code).
  - \`@vitejs/plugin-react\` — React fast refresh.
  - \`@vitejs/plugin-legacy\` — iOS 6 ES5 legacy bundle with polyfills.
  - \`VitePWA\` — InjectManifest strategy with \`src/sw.ts\` as the service worker entry. Precaches JS/CSS/HTML/ico/png/svg/woff2 up to 3MB per file.

---`);

ENHANCEMENTS.set('### vitest.config.ts', `### vitest.config.ts

**File Purpose:** Vitest test runner configuration with platform resolution plugin for testing.

**Functions & Classes:**
- \`platformResolvePlugin\` (function → Vite Plugin)

**Function Details:**
- \`platformResolvePlugin\` — Same resolution logic as vite.config.ts (maps \`.platform\` to web, with pake fallback).
- Plugins: platform resolver + React plugin.
- Test settings:
  - \`globals: true\` — enables global test APIs (describe, it, expect).
  - \`environment: 'jsdom'\` — DOM simulation for component tests.
  - \`setupFiles: './src/setupTests.ts'\` — Jest DOM matchers initialization.

---`);

ENHANCEMENTS.set('### src/main.tsx', `### src/main.tsx

**File Purpose:** Application entry point. Bootstraps the React application into the DOM using StrictMode.

**Functions & Classes:** None (top-level script)

**Function Details:**
- Imports \`StrictMode\` from React for highlighting potential problems in development.
- Imports \`createRoot\` from \`react-dom/client\` for the concurrent React rendering API.
- Imports global styles (\`index.css\`) and the root \`App\` component.
- \`createRoot(document.getElementById('root')!)\` — Initializes the React root on the DOM element with id \`root\`.
- \`.render(...)\` — Wraps the \`App\` component in \`StrictMode\` to enable double-rendering checks and development warnings.

---`);

ENHANCEMENTS.set('### src/App.tsx', `### src/App.tsx

**File Purpose:** Platform abstraction entry point. Uses the \`.platform\` suffix resolution to delegate to the platform-specific App component (web, iOS, or pake).

**Functions & Classes:** None (re-export module)

**Function Details:**
- \`export * from './App.platform'\` — Re-exports all named exports from the resolved platform-specific App file.
- \`export { default } from './App.platform'\` — Re-exports the default export, making this file transparent to consumers who import \`App\`.

---`);

ENHANCEMENTS.set('### src/App.web.tsx', `### src/App.web.tsx

**File Purpose:** Web and Pake (desktop app wrapper) specific application root component. Sets up routing, providers, theme sync, offline support, PWA service worker management, and global keyboard shortcuts.

**Functions & Classes:**
- \`App\` (default component)
- \`AppInner\` (component)
- \`ProtectedRoute\` (component)
- \`RequireGuest\` (component)
- \`UserAppSettingsBridge\` (component)
- \`ThemeSync\` (component)

**Function Details:**
- **\`App\`** (component)
  - Wraps the entire application in \`PersistQueryClientProvider\` (caches React Query state to localStorage with 7-day max age) and \`AuthProvider\`.
- **\`AppInner\`** (component)
  - Initializes real-time transaction sync, Pake desktop notifications, and daily points sync.
  - Seeds the local database when online.
  - Sets up \`window.addEventListener('online', ...)\` to process the offline sync queue when connectivity is restored.
  - Listens for service worker messages (\`LIFEOS_SYNC_OFFLINE_QUEUE\`) to trigger background sync.
  - Global keyboard shortcut: \`Ctrl/Cmd + Enter\` inside form inputs automatically submits the nearest form or clicks the save/submit button in the current modal/sheet.
  - PWA Service Worker management:
    - Reloads the page when a new service worker takes control (skipping the initial claim to prevent loops).
    - Implements a 10-second debounce (\`pwa_reload_time\` in sessionStorage) to prevent infinite reload loops.
    - Checks for SW updates on initial load and when the document becomes visible again, throttled to once per 30 seconds.
  - Router setup: Uses \`BrowserRouter\` for web, \`HashRouter\` for Pake desktop builds (fixes file:// protocol routing).
  - Defines all application routes. Wraps authenticated routes in \`AppShell\`.
  - Mounts \`FaviconSync\` to dynamically update the favicon based on notification counts.
  - Includes Vercel Analytics (\`<Analytics />\`).
- **\`ProtectedRoute\`** (component)
  - Reads \`user\` and \`loading\` from \`useAuth()\`.
  - Returns \`<LoadingScreen />\` while auth state loads.
  - Redirects to \`/login\` if no user is authenticated.
- **\`RequireGuest\`** (component)
  - Redirects authenticated users to \`/dashboard\`.
  - Shows \`LoadingScreen\` during auth initialization.
- **\`UserAppSettingsBridge\`** (component)
  - Invisible component that synchronizes user-specific app settings (theme, accent) to the database.
- **\`ThemeSync\`** (component)
  - Reads \`theme\` (light/dark), \`accentTheme\`, and \`platformUIOverride\` from \`useUIStore()\`.
  - Applies CSS classes to \`<html>\` element and updates the \`theme-color\` meta tag.
  - Adds/removes \`pake-platform\` class for desktop wrapper styling.

---`);

ENHANCEMENTS.set('### src/App.ios.tsx', `### src/App.ios.tsx

**File Purpose:** iOS native application root component. Extends the web version with Capacitor-native integrations: keyboard handling, deep links, local notifications, OTA updates, haptics, and native badge/status bar management.

**Functions & Classes:**
- \`App\` (default component)
- \`AppInner\` (component)
- \`ProtectedRoute\` (component)
- \`RequireGuest\` (component)
- \`UserAppSettingsBridge\` (component)
- \`ThemeSync\` (component)

**Function Details:**
- **\`App\`** (component)
  - Same structure as web but adds iOS-specific Capacitor integrations.
- **\`AppInner\`** (component)
  - Listens for keyboard show/hide events via Capacitor Keyboard plugin and stores \`--keyboard-height\` CSS variable.
  - Sets up deep link listener for \`lifeos://\` URLs with route navigation.
  - Schedules local notifications on app focus using native notification APIs.
  - Checks for OTA updates on app resume via Capacitor Updater.
  - Triggers native haptic feedback on task completion and habit toggle actions.
- **\`ThemeSync\`** (component)
  - Syncs status bar style (light/dark) with app theme via Capacitor Status Bar plugin.
- **\`ProtectedRoute\` / \`RequireGuest\`** (components)
  - Same auth behavior as web, adapted for iOS navigation.

---`);


// Apply enhancements to CODEBASE_DOCUMENTATION.md
console.log('Applying enhancements...');

let content = fs.readFileSync('CODEBASE_DOCUMENTATION.md', 'utf-8');

let replacements = 0;
for (const [key, value] of ENHANCEMENTS) {
  if (content.includes(key)) {
    content = content.replace(key, value);
    replacements++;
    console.log(`Enhanced: ${key.replace('### ', '')}`);
  } else {
    console.log(`Key not found: ${key.replace('### ', '')}`);
  }
}

fs.writeFileSync('CODEBASE_DOCUMENTATION.md', content, 'utf-8');
console.log(`Enhancements applied: ${replacements}/${ENHANCEMENTS.size}`);
