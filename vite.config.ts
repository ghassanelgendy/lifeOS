import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  publicDir: 'public',
  build: {
    rollupOptions: {
      input: 'index.html',
    },
  },
  plugins: [
    react(),
    // Exclude api/* (Vercel serverless) from Vite so esbuild never sees it (avoids "Invalid loader: ics")
    {
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
    },
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
  ],
})
