import { defineConfig, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const host = process.env.TAURI_DEV_HOST
const isTauriBuild = !!process.env.TAURI_ENV_PLATFORM

// https://vite.dev/config/
export default defineConfig({
  clearScreen: false,
  envPrefix: ['VITE_', 'TAURI_ENV_'],
  publicDir: 'public',
  server: {
    port: 5173,
    strictPort: true,
    host: host || false,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  build: {
    target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
    rollupOptions: {
      input: 'index.html',
    },
  },
  plugins: (() => {
    const ignoreApiPlugin: PluginOption = {
      name: 'ignore-api',
      enforce: 'pre',
      resolveId(id) {
        const n = id.replace(/\\/g, '/');
        if (n.includes('/api/') && (n.endsWith('.ts') || n.endsWith('.tsx'))) {
          return '\0virtual:api-stub';
        }
        return null;
      },
      load(id) {
        const n = id.replace(/\\/g, '/');
        if (id === '\0virtual:api-stub' || (n.includes('/api/') && (n.endsWith('.ts') || n.endsWith('.tsx')))) {
          return 'export default {}';
        }
        return null;
      },
      transform(_, id) {
        const n = id.replace(/\\/g, '/');
        if (n.includes('/api/')) {
          return { code: 'export default {}', map: null };
        }
        return null;
      },
    };

    const basePlugins: PluginOption[] = [
      react(),
      // Exclude api/* (Vercel serverless) from Vite so esbuild never sees it (avoids "Invalid loader: ics")
      ignoreApiPlugin,
    ];

    // Desktop (Tauri) should not register/build a service worker to avoid stale cached UI after packaging.
    if (isTauriBuild) return basePlugins;

    return [
      ...basePlugins,
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        registerType: 'autoUpdate',
        manifest: false,
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          globIgnores: ['**/favicon.svg', '**/sw.ts'],
          maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ];
  })(),
})
