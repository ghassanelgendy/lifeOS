/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

function platformResolvePlugin(platform: 'ios' | 'web' | 'pake') {
  return {
    name: 'platform-resolve',
    enforce: 'pre' as const,
    resolveId(source: string, importer?: string) {
      if (source.endsWith('.platform')) {
        let resolvedPlatform = platform;
        if (platform === 'pake' && importer) {
          const importerDir = path.dirname(importer);
          const relativePath = source.replace('.platform', '.pake.tsx');
          const pakeFile = path.resolve(importerDir, relativePath);
          const relativePathTs = source.replace('.platform', '.pake.ts');
          const pakeFileTs = path.resolve(importerDir, relativePathTs);

          if (!fs.existsSync(pakeFile) && !fs.existsSync(pakeFileTs)) {
            resolvedPlatform = 'web';
          }
        }
        const resolved = source.replace('.platform', `.${resolvedPlatform}`);
        return this.resolve(resolved, importer, { skipSelf: true });
      }
      if (source.endsWith('index.css')) {
        let resolvedPlatform = platform;
        if (platform === 'pake' && importer) {
          const importerDir = path.dirname(importer);
          const relativePath = source.replace('index.css', 'index.pake.css');
          const pakeFile = path.resolve(importerDir, relativePath);
          if (!fs.existsSync(pakeFile)) {
            resolvedPlatform = 'web';
          }
        }
        const resolved = source.replace('index.css', `index.${resolvedPlatform}.css`);
        return this.resolve(resolved, importer, { skipSelf: true });
      }
      return null;
    }
  };
}

export default defineConfig({
  plugins: [platformResolvePlugin('web'), react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
  },
});
