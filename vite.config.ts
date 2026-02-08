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
    // Prevent api/*.ts from being processed by esbuild (avoids "Invalid loader: ics" from PWA build)
    {
      name: 'ignore-api',
      load(id) {
        const n = id.replace(/\\/g, '/');
        if (n.includes('/api/') && (n.endsWith('.ts') || n.endsWith('.tsx'))) {
          return 'export default {}';
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
