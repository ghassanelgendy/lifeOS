import { defineConfig, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'
import { VitePWA } from 'vite-plugin-pwa'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import fs from 'node:fs'
import path from 'node:path'

const isIos6Legacy = process.env.IOS6_LEGACY === '1'

// https://vite.dev/config/
function platformResolvePlugin(platform: 'ios' | 'web' | 'pake'): PluginOption {
  return {
    name: 'platform-resolve',
    enforce: 'pre',
    resolveId(source, importer) {
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

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const platform = mode === 'ios' ? 'ios' : mode === 'pake' ? 'pake' : 'web';
  console.log(`[Vite Platform Build] Mode: ${mode} -> Target Platform: ${platform}`);

  return {
    clearScreen: false,
    envPrefix: ['VITE_'],
    publicDir: 'public',
    server: {
      port: 5173,
      strictPort: true,
    },
    build: {
      target: isIos6Legacy ? 'es5' : 'safari13',
      minify: 'esbuild',
      sourcemap: false,
      rollupOptions: {
        input: 'index.html',
      },
    },
    plugins: (() => {
      const devApiProxyPlugin: PluginOption = {
        name: 'dev-api-proxy',
        apply: 'serve',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            const requestUrl = req.url || '';
            const parsed = new URL(requestUrl, 'http://localhost');

            if (parsed.pathname === '/api/calendar/tasks') {
              try {
                const query: Record<string, string | string[]> = {};
                parsed.searchParams.forEach((value, key) => {
                  const existing = query[key];
                  if (Array.isArray(existing)) {
                    query[key] = [...existing, value];
                  } else if (existing) {
                    query[key] = [existing, value];
                  } else {
                    query[key] = value;
                  }
                });

                const apiRes = {
                  setHeader(name: string, value: number | string | readonly string[]) {
                    res.setHeader(name, value);
                    return apiRes;
                  },
                  status(code: number) {
                    res.statusCode = code;
                    return apiRes;
                  },
                  json(body: unknown) {
                    if (!res.headersSent) res.setHeader('Content-Type', 'application/json; charset=utf-8');
                    res.end(JSON.stringify(body));
                    return apiRes;
                  },
                  send(body: unknown) {
                    if (typeof body === 'string' || body instanceof Uint8Array) {
                      res.end(body);
                    } else {
                      if (!res.headersSent) res.setHeader('Content-Type', 'application/json; charset=utf-8');
                      res.end(JSON.stringify(body));
                    }
                    return apiRes;
                  },
                  end(body?: unknown) {
                    if (typeof body === 'string' || body instanceof Uint8Array || body === undefined) {
                      res.end(body);
                    } else {
                      res.end(JSON.stringify(body));
                    }
                    return apiRes;
                  },
                };

                const { default: handler } = await import('./api/calendar/tasks.ts');
                await handler(
                  { method: req.method, query, headers: req.headers } as VercelRequest,
                  apiRes as unknown as VercelResponse
                );
              } catch (err) {
                console.error('[dev-calendar-feed]', err);
                if (!res.headersSent) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json; charset=utf-8');
                }
                res.end(JSON.stringify({ error: 'Feed unavailable' }));
              }
              return;
            }

            if (parsed.pathname !== '/api/proxy') {
              next();
              return;
            }

            if (req.method !== 'GET') {
              res.statusCode = 405;
              res.setHeader('Allow', 'GET');
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ error: 'Method not allowed' }));
              return;
            }

            const rawUrl = parsed.searchParams.get('url') || '';
            const normalizedUrl = rawUrl.trim().replace(/^webcal:\/\//i, 'https://');
            if (!normalizedUrl || (!normalizedUrl.startsWith('https://') && !normalizedUrl.startsWith('http://'))) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ error: 'Missing or invalid url' }));
              return;
            }

            try {
              const response = await fetch(normalizedUrl, {
                headers: {
                  'User-Agent': 'lifeOS/1.0',
                  Accept: 'text/calendar, text/plain, */*',
                },
                cache: 'no-store',
              });

              if (!response.ok) {
                res.statusCode = response.status;
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.end(JSON.stringify({ error: 'Upstream error' }));
                return;
              }

              const text = await response.text();
              res.statusCode = 200;
              res.setHeader('Content-Type', response.headers.get('Content-Type') || 'text/calendar; charset=utf-8');
              res.setHeader('Cache-Control', 'no-store, no-cache, max-age=0, must-revalidate');
              res.setHeader('CDN-Cache-Control', 'no-store');
              res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
              res.setHeader('Pragma', 'no-cache');
              res.setHeader('Expires', '0');
              res.end(text);
            } catch (err) {
              console.error('[dev-api-proxy]', err);
              res.statusCode = 502;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ error: 'Failed to fetch' }));
            }
          });
        },
      };

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
        platformResolvePlugin(platform),
        devApiProxyPlugin,
        react(),
        ...(isIos6Legacy
          ? [
              legacy({
                // iOS 6 needs ES5 + lots of polyfills.
                targets: ['ios >= 6'],
                modernPolyfills: false,
                renderLegacyChunks: true,
              }),
            ]
          : []),
        // Exclude api/* (Vercel serverless) from Vite so esbuild never sees it (avoids "Invalid loader: ics")
        ignoreApiPlugin,
      ];

      // iOS 6 WebKit: no service workers; registerSW + modern SW can break or confuse old Safari.
      if (isIos6Legacy) return basePlugins

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
            enabled: false,
            type: 'module',
          },
        }),
      ];
    })(),
  };
});
