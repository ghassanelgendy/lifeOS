#!/usr/bin/env node
/**
 * build-codemap.mjs — generates a structured code graph for AI agents.
 *
 * Output (in .agents/codemap/):
 *   graph.json        nodes + edges + reverse deps (machine-readable, greppable)
 *   tables.json       supabase table -> consuming modules (reverse index)
 *   CODEMAP.md        compact human/agent-readable map (load this first)
 *
 * Zero dependencies: uses regex-based extraction, not a full TS AST. That is a
 * deliberate trade-off — it is resilient to the TS 7.x/6.x churn in this repo
 * (see scripts/lint.mjs) and fast enough to run on every commit.
 *
 * Run: node scripts/build-codemap.mjs
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT_DIR = path.join(ROOT, '.agents', 'codemap');

/** Directories we actually care about (source of truth, not build output). */
const SCAN_ROOTS = ['src', 'api', 'supabase/functions', 'extension', 'lib'];

/** Never walk into these — build artifacts, vendored copies, lockfiles. */
const SKIP_DIR = new Set([
  'node_modules', 'dist', 'build', '.git', 'android', 'ios', 'public',
  'coverage', '.vercel', '.next', 'generated', 'scratch', 'testing', '.temp',
]);

const CODE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs']);

// ---------------------------------------------------------------- file walking

function walk(dir, acc = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    if (e.name.startsWith('.') && e.name !== '.agents') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIR.has(e.name)) continue;
      walk(full, acc);
    } else if (CODE_EXT.has(path.extname(e.name))) {
      acc.push(full);
    }
  }
  return acc;
}

const files = SCAN_ROOTS.flatMap((r) => walk(path.join(ROOT, r)));
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
const fileSet = new Set(files.map(rel));

// ------------------------------------------------------------------ extraction

const IMPORT_RE = /(?:^|\n)\s*(?:import|export)\s+(?:[\s\S]*?)\sfrom\s*['"]([^'"]+)['"]/g;
const BARE_IMPORT_RE = /(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g;
const DYNAMIC_RE = /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;
const REQUIRE_RE = /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g;

const EXPORT_NAMED_RE =
  /(?:^|\n)export\s+(?:async\s+)?(?:const|let|var|function|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g;
const EXPORT_LIST_RE = /(?:^|\n)export\s*\{([^}]*)\}/g;
const EXPORT_DEFAULT_RE = /(?:^|\n)export\s+default\s+(?:function\s+)?([A-Za-z_$][\w$]*)?/g;

const TABLE_RE = /\.from\(\s*['"`]([a-zA-Z0-9_]+)['"`]\s*\)/g;
const RPC_RE = /\.rpc\(\s*['"`]([a-zA-Z0-9_]+)['"`]/g;
const QUERYKEY_RE = /queryKey:\s*\[\s*['"`]([^'"`]+)['"`]/g;
const FN_INVOKE_RE = /functions\.invoke\(\s*['"`]([^'"`]+)['"`]/g;
const EDGE_FETCH_RE = /\/functions\/v1\/([a-zA-Z0-9-_]+)/g;

function matchAll(re, src, group = 1) {
  const out = new Set();
  re.lastIndex = 0;
  let m;
  while ((m = re.exec(src)) !== null) if (m[group]) out.add(m[group]);
  return [...out];
}

// --------------------------------------------------------------- classification

function classify(r) {
  if (/\.(test|spec)\.[tj]sx?$/.test(r)) return 'test';
  if (r.startsWith('src/routes/')) return 'route';
  if (r.startsWith('src/hooks/')) return 'hook';
  if (r.startsWith('src/stores/')) return 'store';
  if (r.startsWith('src/contexts/')) return 'context';
  if (r.startsWith('src/components/ui/')) return 'ui-primitive';
  if (r.startsWith('src/components/')) return 'component';
  if (r.startsWith('src/lib/')) return 'lib';
  if (r.startsWith('src/db/')) return 'local-db';
  if (r.startsWith('src/types/')) return 'types';
  if (r.startsWith('src/data/')) return 'static-data';
  if (r.startsWith('api/cron/')) return 'vercel-cron';
  if (r.startsWith('api/')) return 'vercel-fn';
  if (r.startsWith('supabase/functions/')) return 'edge-fn';
  if (r.startsWith('extension/')) return 'extension';
  if (r.startsWith('lib/')) return 'workspace-pkg';
  if (r.startsWith('src/')) return 'app-entry';
  return 'other';
}

/** `Foo.web.tsx` -> { base: 'src/x/Foo', platform: 'web' } */
function platformOf(r) {
  const m = r.match(/^(.*)\.(web|ios|pake)\.(tsx?|jsx?)$/);
  if (m) return { base: m[1], platform: m[2] };
  return { base: r.replace(/\.(tsx?|jsx?)$/, ''), platform: null };
}

// ------------------------------------------------------------------- resolution

/** Resolve a relative/alias specifier to a repo-relative file, or null if external. */
function resolveImport(spec, fromFile, platform = 'web') {
  let target;
  if (spec.startsWith('.')) {
    target = path.join(path.dirname(fromFile), spec);
  } else if (spec.startsWith('@/')) {
    target = path.join('src', spec.slice(2));
  } else if (spec.startsWith('src/') || spec.startsWith('api/')) {
    target = spec;
  } else {
    return null; // bare package import
  }
  target = target.split(path.sep).join('/').replace(/^\.\//, '');

  // The `.platform` fake extension (see platformResolvePlugin in vite.config.ts)
  if (target.endsWith('.platform')) {
    const stem = target.slice(0, -'.platform'.length);
    const order = platform === 'ios'
      ? ['ios']
      : platform === 'pake'
        ? ['pake', 'web']
        : ['web'];
    for (const p of order) {
      for (const ext of ['.tsx', '.ts']) {
        if (fileSet.has(`${stem}.${p}${ext}`)) return `${stem}.${p}${ext}`;
      }
    }
    return null;
  }

  const candidates = [
    target,
    `${target}.ts`, `${target}.tsx`, `${target}.js`, `${target}.jsx`, `${target}.mjs`,
    `${target}/index.ts`, `${target}/index.tsx`, `${target}/index.js`,
  ];
  for (const c of candidates) if (fileSet.has(c)) return c;
  return null;
}

// --------------------------------------------------------------- build the graph

const nodes = new Map();
const edges = [];
const externals = new Map();

for (const abs of files) {
  const r = rel(abs);
  let src;
  try {
    src = fs.readFileSync(abs, 'utf8');
  } catch {
    continue;
  }

  const specs = [
    ...matchAll(IMPORT_RE, src),
    ...matchAll(BARE_IMPORT_RE, src),
    ...matchAll(DYNAMIC_RE, src),
    ...matchAll(REQUIRE_RE, src),
  ];

  const exportsNamed = new Set(matchAll(EXPORT_NAMED_RE, src));
  for (const list of matchAll(EXPORT_LIST_RE, src)) {
    for (const piece of list.split(',')) {
      const name = piece.trim().split(/\s+as\s+/).pop()?.trim();
      if (name && /^[A-Za-z_$][\w$]*$/.test(name)) exportsNamed.add(name);
    }
  }
  const defaultExport = matchAll(EXPORT_DEFAULT_RE, src)[0] || null;

  const { base, platform } = platformOf(r);
  const node = {
    id: r,
    kind: classify(r),
    base,
    platform,
    loc: src.split('\n').length,
    bytes: src.length,
    exports: [...exportsNamed].sort(),
    default: defaultExport,
    tables: matchAll(TABLE_RE, src).sort(),
    rpcs: matchAll(RPC_RE, src).sort(),
    queryKeys: matchAll(QUERYKEY_RE, src).sort(),
    invokesEdgeFns: [
      ...new Set([...matchAll(FN_INVOKE_RE, src), ...matchAll(EDGE_FETCH_RE, src)]),
    ].sort(),
    isZustand: /\bcreate[<(]/.test(src) && /zustand/.test(src),
    usesReactQuery: /useQuery|useMutation|useInfiniteQuery/.test(src),
    hasPlatformImport: specs.some((s) => s.endsWith('.platform')),
    imports: [],
    importedBy: [],
  };
  nodes.set(r, node);

  for (const spec of specs) {
    const resolved = resolveImport(spec, r);
    if (resolved && resolved !== r) {
      edges.push({ from: r, to: resolved, spec });
    } else if (!resolved && !spec.startsWith('.') && !spec.startsWith('@/')) {
      const pkg = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
      externals.set(pkg, (externals.get(pkg) || 0) + 1);
    }
  }
}

// wire adjacency (dedup)
const seen = new Set();
for (const e of edges) {
  const k = `${e.from}>${e.to}`;
  if (seen.has(k)) continue;
  seen.add(k);
  nodes.get(e.from)?.imports.push(e.to);
  nodes.get(e.to)?.importedBy.push(e.from);
}

// -------------------------------------------------------------- derived indexes

/** Platform variant families: base -> { web, ios, pake, shim } */
const variants = new Map();
for (const n of nodes.values()) {
  if (n.kind === 'test') continue;
  const fam = variants.get(n.base) || { base: n.base, web: null, ios: null, pake: null, shim: null };
  if (n.platform) fam[n.platform] = n.id;
  else fam.shim = n.id;
  variants.set(n.base, fam);
}
const variantFamilies = [...variants.values()].filter(
  (f) => f.web || f.ios || f.pake
);

/** table -> modules touching it */
const tableIndex = new Map();
for (const n of nodes.values()) {
  for (const t of n.tables) {
    if (!tableIndex.has(t)) tableIndex.set(t, { table: t, readWrite: [] });
    tableIndex.get(t).readWrite.push(n.id);
  }
}

/** edge function name -> definition + callers (only `<name>/index.ts` is a function) */
const edgeFns = new Map();
for (const n of nodes.values()) {
  const m = n.id.match(/^supabase\/functions\/([^/]+)\/index\.ts$/);
  if (m) {
    const name = m[1];
    const rec = edgeFns.get(name) || { name, defines: [], calledBy: [] };
    rec.defines.push(n.id);
    edgeFns.set(name, rec);
  }
}
for (const n of nodes.values()) {
  for (const f of n.invokesEdgeFns) {
    const rec = edgeFns.get(f) || { name: f, defines: [], calledBy: [] };
    if (!rec.calledBy.includes(n.id)) rec.calledBy.push(n.id);
    edgeFns.set(f, rec);
  }
}

const list = [...nodes.values()];
const hubs = list
  .filter((n) => n.kind !== 'test')
  .sort((a, b) => b.importedBy.length - a.importedBy.length)
  .slice(0, 25);

/**
 * Modules with no inbound edge.
 *
 * CRITICAL: a `.ios`/`.pake` variant legitimately has no inbound edge in this graph,
 * because `.platform` specifiers resolve against `web` (see resolveImport). Those files
 * ARE reachable — under `--mode ios` / `--mode pake`. Excluding them is what keeps this
 * section from reading as "safe to delete" for live platform code.
 */
const reachableViaPlatform = new Set();
for (const fam of variants.values()) {
  if (!fam.shim) continue;
  for (const id of [fam.web, fam.ios, fam.pake]) if (id) reachableViaPlatform.add(id);
}

const orphans = list.filter(
  (n) =>
    n.kind !== 'test' &&
    n.importedBy.length === 0 &&
    !reachableViaPlatform.has(n.id) &&
    !['route', 'vercel-fn', 'vercel-cron', 'edge-fn', 'extension', 'app-entry'].includes(n.kind) &&
    !/\b(main|sw|setupTests)\b/.test(n.id) &&
    !/\.(config|d)\.[tj]sx?$/.test(n.id)
);

const byKind = {};
for (const n of list) byKind[n.kind] = (byKind[n.kind] || 0) + 1;

const totalLoc = list.reduce((s, n) => s + n.loc, 0);

// ------------------------------------------------------------------ emit JSON

fs.mkdirSync(OUT_DIR, { recursive: true });

const graph = {
  generatedAt: new Date().toISOString(),
  generator: 'scripts/build-codemap.mjs',
  stats: { files: list.length, loc: totalLoc, edges: seen.size, byKind },
  nodes: list.map((n) => ({
    id: n.id,
    kind: n.kind,
    platform: n.platform,
    loc: n.loc,
    exports: n.exports,
    default: n.default,
    tables: n.tables,
    rpcs: n.rpcs,
    queryKeys: n.queryKeys,
    invokesEdgeFns: n.invokesEdgeFns,
    usesReactQuery: n.usesReactQuery,
    isZustand: n.isZustand,
    imports: n.imports.sort(),
    importedBy: n.importedBy.sort(),
  })),
  variantFamilies,
  topExternalDeps: [...externals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40)
    .map(([pkg, count]) => ({ pkg, count })),
};

fs.writeFileSync(path.join(OUT_DIR, 'graph.json'), JSON.stringify(graph, null, 1));
fs.writeFileSync(
  path.join(OUT_DIR, 'tables.json'),
  JSON.stringify(
    {
      generatedAt: graph.generatedAt,
      note: 'Supabase tables/RPCs referenced via .from()/.rpc(), and edge functions, with their consumers.',
      tables: [...tableIndex.values()].sort((a, b) => a.table.localeCompare(b.table)),
      edgeFunctions: [...edgeFns.values()].sort((a, b) => a.name.localeCompare(b.name)),
    },
    null,
    1
  )
);

// ------------------------------------------------------------------- emit MD

const fmt = (arr, n = 8) =>
  arr.length <= n ? arr.join(', ') : `${arr.slice(0, n).join(', ')} … (+${arr.length - n})`;

const routeNodes = list.filter((n) => n.kind === 'route' && !n.platform);
const hookNodes = list.filter((n) => n.kind === 'hook' && !n.platform);

/**
 * Real URL paths, read out of the router rather than guessed from filenames
 * (the filename guess turns `weekly-planner` into `weeklyplanner`).
 * Maps route module -> mounted path(s).
 */
function extractRoutePaths(entry) {
  const abs = path.join(ROOT, entry);
  if (!fs.existsSync(abs)) return new Map();
  const src = fs.readFileSync(abs, 'utf8');

  // local identifier -> resolved route module
  const local = new Map();
  const defImp = /import\s+([A-Za-z_$][\w$]*)\s+from\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = defImp.exec(src)) !== null) {
    const resolved = resolveImport(m[2], entry);
    if (resolved) local.set(m[1], resolved);
  }

  const out = new Map();
  const routeRe = /<Route\s+path="([^"]+)"\s+element=\{([\s\S]{0,160}?)\}\s*\/?>/g;
  while ((m = routeRe.exec(src)) !== null) {
    const [, p, element] = m;
    for (const c of element.matchAll(/<([A-Z][\w$]*)/g)) {
      const file = local.get(c[1]);
      if (!file) continue;
      const url = p.startsWith('/') ? p : `/${p}`;
      if (!out.has(file)) out.set(file, []);
      if (!out.get(file).includes(url)) out.get(file).push(url);
    }
  }
  return out;
}

const routePaths = extractRoutePaths('src/App.web.tsx');

let md = `# lifeOS Code Map

> **Generated** — do not hand-edit. Regenerate with \`node scripts/build-codemap.mjs\`.
> Companions: [\`graph.json\`](./graph.json) (full node/edge graph), [\`tables.json\`](./tables.json) (data index).

**Read this file first.** It is designed so an agent can locate the right 2–5 files
for a task without grepping the tree. ${graph.stats.files} source files,
${totalLoc.toLocaleString()} LOC, ${seen.size} internal import edges.

## 0. How to use this map

1. Find your task in **§1 Task router**.
2. Confirm the file set in **§4 Feature map** (route → hook → tables).
3. **Before editing any file, check §3 Platform variants.** Editing only the file you
   opened is the single most common mistake in this repo.
4. Need callers/callees of a specific module? \`jq\` into \`graph.json\`:
   \`\`\`bash
   jq '.nodes[] | select(.id=="src/hooks/useTasks.web.ts") | {imports, importedBy}' .agents/codemap/graph.json
   jq -r '.tables[] | select(.table=="tasks") | .readWrite[]' .agents/codemap/tables.json
   \`\`\`

## 1. Task router

| If the task is… | Start here |
|---|---|
| Add/change a screen | \`src/routes/<Name>.{web,ios,pake}.tsx\` + route table in \`src/App.web.tsx\` + \`src/components/navItems.ts\` |
| Add/change persisted data | \`src/hooks/use<Domain>.ts\` (React Query) → \`src/types/schema.ts\` → \`supabase/migrations/\` |
| Networking / sync / egress | \`src/lib/api-limiter.ts\`, \`src/lib/queryClient.ts\`, \`src/lib/offlineSync.ts\` — **read \`API_EGRESS_FIX.md\` first** |
| Auth / session | \`src/contexts/AuthContext.tsx\`, \`src/hooks/useAuth.ts\` |
| Client-only UI state | \`src/stores/use*Store.ts\` (Zustand) — never put server state here |
| Server-side job / webhook | \`supabase/functions/<name>/index.ts\` (Deno) or \`api/\` (Vercel) |
| Scheduled job | \`api/cron/*.ts\` + \`vercel.json\` crons + \`docs/CRON.md\` |
| Notifications | \`src/hooks/usePushNotifications.{web,ios,pake}.ts\`, \`src/lib/push.ts\`, \`supabase/functions/*-notifications-dispatch\` |
| Native bridge (haptics/tray/badge) | \`src/lib/nativeBridge.ts\`, \`src/hooks/useNative*.ts\`, \`src/lib/otaUpdater.ts\` |
| Shared UI primitive | \`src/components/ui/\` (export via \`src/components/ui/index.ts\`) |
| Browser extension | \`extension/\` — separate codebase, duplicates its own Supabase client |
| Any feature-level change | **Also update \`PRD.md\`, \`CODEBASE_SRS.md\`, \`CODEBASE_DOCUMENTATION.md\`** (in-app Wiki reads them) |
| Verifying your change | \`pnpm typecheck\` • \`pnpm lint\` • \`pnpm test\` — note typecheck is *baselined*, see §8 |

## 2. Entry points & shell

\`\`\`
index.html → src/main.tsx → src/App.tsx ──(.platform)──> App.web.tsx | App.ios.tsx
                                                              │
   PersistQueryClientProvider (localStorage, 7d)  ────────────┤
   AuthProvider → ErrorBoundary → AppInner                    │
                                                              ▼
   BrowserRouter (web) / HashRouter (pake)  →  ProtectedRoute → AppShell → <Outlet/>
\`\`\`

Public routes: \`/\`, \`/login\`, \`/signup\`, \`/wiki\`, \`/wiki/:pageTitle\`.
Everything else sits behind \`ProtectedRoute\` + \`AppShell\`.

Background workers mounted once in \`AppInner\`: \`useTransactionsRealtime\`,
\`useAzkarRealtime\`, \`usePakeLocalNotifications\`, \`useNativeTraySync\`,
\`useDailyPointsSync\`, offline-queue drain, midnight brain-dump organizer.

## 3. Platform variants — read before editing

\`.platform\` is a **fake extension** rewritten at resolve time by
\`platformResolvePlugin\` (\`vite.config.ts\`, mirrored in \`vitest.config.ts\` pinned to \`web\`):

| mode | resolves \`./X.platform\` to |
|---|---|
| default / web | \`X.web.tsx\` |
| \`--mode ios\` | \`X.ios.tsx\` — **no fallback; missing file = build error** |
| \`--mode pake\` | \`X.pake.tsx\` if present, else \`X.web.tsx\` |

Bare \`index.css\` is rewritten the same way → \`index.web.css\` / \`index.ios.css\` / \`index.pake.css\`.

${variantFamilies.length} variant families exist. Families **missing an \`.ios\` variant are an
iOS-build risk**; families with \`.pake\` silently diverge from web.

| Base | shim | web | ios | pake |
|---|---|---|---|---|
${variantFamilies
  .sort((a, b) => a.base.localeCompare(b.base))
  .map(
    (f) =>
      `| \`${f.base.replace(/^src\//, '')}\` | ${f.shim ? '✓' : '—'} | ${f.web ? '✓' : '—'} | ${f.ios ? '✓' : '⚠︎'} | ${f.pake ? '✓' : '·'} |`
  )
  .join('\n')}

## 4. Feature map (route → hooks → tables)

| Route | Component | Primary hooks | Tables touched |
|---|---|---|---|
${routeNodes
  .sort((a, b) => a.id.localeCompare(b.id))
  .map((n) => {
    const fam = variants.get(n.base);
    const impls = [fam?.web, fam?.ios, fam?.pake].filter(Boolean);
    const reach = new Set();
    const tabs = new Set();
    const walkDeps = (id, depth = 0) => {
      if (depth > 2 || !id) return;
      const node = nodes.get(id);
      if (!node) return;
      for (const t of node.tables) tabs.add(t);
      for (const imp of node.imports) {
        const d = nodes.get(imp);
        if (!d) continue;
        if (d.kind === 'hook') reach.add(path.basename(d.id).replace(/\.(web|ios|pake)?\.?tsx?$/, ''));
        if (d.kind === 'hook' || d.kind === 'lib') walkDeps(imp, depth + 1);
      }
    };
    for (const i of impls.length ? impls : [n.id]) walkDeps(i);
    const name = path.basename(n.base);
    const urls = routePaths.get(n.id) || [];
    const urlCell = urls.length
      ? urls.map((u) => `\`${u}\``).join(' ')
      : '— *(not mounted directly)*';
    return `| ${urlCell} | \`${name}\` | ${fmt([...reach].sort(), 5) || '—'} | ${fmt([...tabs].sort(), 6) || '—'} |`;
  })
  .join('\n')}

> Hook/table columns are computed transitively (depth ≤ 2) from import edges, so they
> show *reachable* data, not necessarily data used on first paint.

## 5. Data layer

- **Source of truth:** Supabase Postgres via \`src/lib/supabase.ts\`.
  \`installApiLimiter()\` runs **before** \`createClient\` so the SDK's own fetch is gated.
- **Cache/transport:** React Query (\`src/lib/queryClient.ts\`) — \`staleTime\` 30 min,
  \`gcTime\` 24 h, \`refetchOnWindowFocus: false\`, \`refetchOnReconnect: true\`.
  \`invalidateQueries\` is monkey-patched to **no-op during limiter emergency mode**.
- **Legacy/offline cache:** \`src/db/database.ts\`, \`src/db/indexedDb.ts\` — *not* source of truth.
- **Offline writes:** queued in \`src/lib/offlineSync.ts\`, drained on \`online\` +
  \`visibilitychange\` + a 120 s interval + service-worker message.

### Tables by consumer count

| Table | Modules |
|---|---|
${[...tableIndex.values()]
  .sort((a, b) => b.readWrite.length - a.readWrite.length || a.table.localeCompare(b.table))
  .slice(0, 30)
  .map((t) => `| \`${t.table}\` | ${t.readWrite.length} — ${fmt(t.readWrite.map((x) => x.replace(/^src\//, '')), 4)} |`)
  .join('\n')}

Full index (every table + every consumer): \`tables.json\`.

### Edge functions

| Function | Defined | Called from |
|---|---|---|
${[...edgeFns.values()]
  .sort((a, b) => a.name.localeCompare(b.name))
  .map(
    (f) =>
      `| \`${f.name}\` | ${f.defines.length ? '✓' : '⚠︎ missing'} | ${f.calledBy.length ? fmt(f.calledBy.map((x) => x.replace(/^src\//, '')), 3) : '— (cron/webhook only)'} |`
  )
  .join('\n')}

## 6. Change-risk hubs

Most-imported modules — editing these has the widest blast radius.

| Module | Imported by | Kind | LOC |
|---|---|---|---|
${hubs
  .slice(0, 20)
  .map((n) => `| \`${n.id}\` | ${n.importedBy.length} | ${n.kind} | ${n.loc} |`)
  .join('\n')}

## 7. Hooks inventory

| Hook | Variants | Exports |
|---|---|---|
${hookNodes
  .sort((a, b) => a.id.localeCompare(b.id))
  .map((n) => {
    const fam = variants.get(n.base);
    const v = [fam?.web && 'web', fam?.ios && 'ios', fam?.pake && 'pake'].filter(Boolean);
    const impl = nodes.get(fam?.web || n.id) || n;
    return `| \`${path.basename(n.base)}\` | ${v.length ? v.join('/') : 'single'} | ${fmt(impl.exports, 5) || '—'} |`;
  })
  .join('\n')}

## 8. Invariants / landmines

1. **No polling.** Short-interval \`setInterval\` refetch loops caused an egress
   incident (\`API_EGRESS_FIX.md\`). Don't shorten \`staleTime\`/\`gcTime\`; don't add
   refetch intervals. \`screentime\` and \`sleep\` are deliberately throttled.
2. **All Supabase traffic goes through \`src/lib/supabase.ts\`** so the limiter wraps it.
   A bare \`fetch\` to Supabase bypasses the circuit breaker.
3. **Edit every platform variant**, not just the one you opened (§3).
4. **Server state → React Query. Client UI state → Zustand.** Don't mix.
5. **Docs sync is mandatory** for feature changes: \`PRD.md\`, \`CODEBASE_SRS.md\`,
   \`CODEBASE_DOCUMENTATION.md\` feed the in-app Wiki (\`src/lib/wikiData.ts\`).
6. **TypeScript is pinned oddly** (\`typescript\` → \`@typescript/typescript6\`, plus a
   \`@typescript/native\` 7.x devDep). \`scripts/lint.mjs\` self-skips on TS 7.x — that is
   intentional; don't "fix" it by downgrading TS.
7. **\`extension/\` is standalone** vanilla JS with its own Supabase/AI client. Changes in
   \`src/lib\` do **not** propagate there.
8. **\`pnpm typecheck\` is a baselined gate, not a clean build.** Root \`tsconfig.json\` is a
   solution file (\`"files": []\` + \`references\`) and plain \`tsc --noEmit\` follows no
   references — so the old gate checked *zero* files and always passed, hiding 79 genuine
   \`TS2304 Cannot find name\` bugs (since fixed). \`scripts/typecheck.mjs\` now:
   - checks \`tsconfig.app.json\` + \`tsconfig.node.json\`;
   - structurally drops \`.platform\` resolution errors — \`tsc\` cannot follow the fake
     extension, and every \`TS2305\` in the tree is verified to come from one of the 25
     shim families, so this is a build-design artifact rather than a defect;
   - fails only on errors absent from \`scripts/typecheck-baseline.json\`.

   | command | purpose |
   |---|---|
   | \`pnpm typecheck\` | the gate — fails on new errors only |
   | \`pnpm typecheck:raw\` | unfiltered \`tsc\` output |
   | \`pnpm typecheck:baseline\` | re-record the baseline after fixing debt (shrink, don't grow) |

   Pre-existing debt is baselined (mostly implicit-\`any\` params and unused vars).
   A green gate means *no regression*, not a clean tree.
9. Gate checks before done: \`pnpm typecheck\` • \`pnpm lint\` • \`pnpm test\`.

## 9. Possibly-unreferenced modules

No inbound import edges found. Some are legitimately entry points or
dynamically/string-referenced — verify before deleting.

${orphans.length ? orphans.map((n) => `- \`${n.id}\` (${n.kind}, ${n.loc} LOC)`).join('\n') : '- none'}

## 10. Counts

${Object.entries(byKind)
  .sort((a, b) => b[1] - a[1])
  .map(([k, v]) => `- ${k}: ${v}`)
  .join('\n')}
`;

fs.writeFileSync(path.join(OUT_DIR, 'CODEMAP.md'), md);

console.log(`[codemap] ${graph.stats.files} files, ${totalLoc} LOC, ${seen.size} edges`);
console.log(`[codemap] ${variantFamilies.length} platform variant families`);
console.log(`[codemap] ${tableIndex.size} tables, ${edgeFns.size} edge functions`);
console.log(`[codemap] ${orphans.length} possibly-unreferenced modules`);
console.log(`[codemap] wrote ${path.relative(ROOT, OUT_DIR)}/{CODEMAP.md,graph.json,tables.json}`);
