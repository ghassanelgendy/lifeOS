#!/usr/bin/env node
/**
 * typecheck.mjs — a typecheck gate that actually fails on regressions.
 *
 * Why this exists
 * ---------------
 * `tsc --noEmit` (the old `pnpm typecheck`) resolved to the root `tsconfig.json`,
 * which is a solution file: `"files": []` plus `references`. Without `-b`, tsc does
 * not follow project references, so the command typechecked ZERO files and always
 * exited 0. It hid 79 genuine `TS2304 Cannot find name` bugs.
 *
 * Checking the real projects surfaces ~880 errors, so a plain `tsc` cannot gate
 * anything yet. This script makes it useful in two steps:
 *
 *   1. Structurally drop `.platform` resolution errors. `src/hooks/useTasks.ts` is
 *      `export * from './useTasks.platform'`, and `.platform` is a fake extension that
 *      only Vite/Vitest rewrite (see platformResolvePlugin in vite.config.ts). tsc
 *      cannot follow it, so every consumer reports TS2305 "has no exported member".
 *      That is an artifact of the build design, not a defect — and it is verified to
 *      account for every TS2305 in the tree.
 *
 *   2. Baseline the remaining pre-existing debt (implicit any, unused vars, …) and
 *      fail only on NEW errors. Fixing baselined errors is reported so the baseline
 *      can shrink over time.
 *
 * Usage:
 *   node scripts/typecheck.mjs            # gate: fail on new errors
 *   node scripts/typecheck.mjs --update   # re-record the baseline
 *   node scripts/typecheck.mjs --raw      # unfiltered tsc output
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const BASELINE = path.join(ROOT, 'scripts', 'typecheck-baseline.json');
const PROJECTS = ['tsconfig.app.json', 'tsconfig.node.json'];

const argv = process.argv.slice(2);
const UPDATE = argv.includes('--update');
const RAW = argv.includes('--raw');

const tsc = path.join(ROOT, 'node_modules', '.bin', 'tsc');
if (!fs.existsSync(tsc)) {
  console.error('[typecheck] node_modules/.bin/tsc not found — run `pnpm install` first.');
  process.exit(1);
}

// ------------------------------------------------------------------- run tsc

/** tsc exits non-zero when it reports errors; capture stdout either way. */
function runProject(project) {
  try {
    return execFileSync(tsc, ['--noEmit', '-p', project], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (err) {
    if (err.stdout !== undefined) return `${err.stdout}${err.stderr || ''}`;
    throw err;
  }
}

const rawOutput = PROJECTS.filter((p) => fs.existsSync(path.join(ROOT, p)))
  .map(runProject)
  .join('\n');

if (RAW) {
  process.stdout.write(rawOutput);
  process.exit(0);
}

const ERROR_RE = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/;
const all = [];
for (const line of rawOutput.split('\n')) {
  const m = line.match(ERROR_RE);
  if (!m) continue;
  const [, file, lineNo, col, code, message] = m;
  all.push({
    file: file.split(path.sep).join('/'),
    line: Number(lineNo),
    col: Number(col),
    code,
    message: message.trim(),
  });
}

// ------------------------------------------- structural `.platform` filtering

/** Files that re-export through the fake `.platform` extension. */
const shims = new Set();
(function collectShims(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (['node_modules', 'dist', '.git'].includes(e.name)) continue;
      collectShims(full);
    } else if (/\.tsx?$/.test(e.name)) {
      let src;
      try {
        src = fs.readFileSync(full, 'utf8');
      } catch {
        continue;
      }
      if (/from\s*['"][^'"]+\.platform['"]/.test(src)) {
        shims.add(path.relative(ROOT, full).split(path.sep).join('/'));
      }
    }
  }
})(path.join(ROOT, 'src'));

/** Resolve a specifier as written in a tsc message, relative to the erroring file. */
function resolvesToShim(errorFile, specifier) {
  if (!specifier.startsWith('.')) return false;
  const base = path
    .join(path.dirname(errorFile), specifier)
    .split(path.sep)
    .join('/');
  for (const cand of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
    if (shims.has(cand)) return true;
  }
  return false;
}

const MODULE_RE = /Module '"([^"]+)"'|Cannot find module '([^']+)'/;

function isPlatformArtifact(e) {
  if (e.code !== 'TS2305' && e.code !== 'TS2307' && e.code !== 'TS2614') return false;
  const m = e.message.match(MODULE_RE);
  const spec = m?.[1] ?? m?.[2];
  if (!spec) return false;
  return resolvesToShim(e.file, spec);
}

const platformArtifacts = all.filter(isPlatformArtifact);
const real = all.filter((e) => !isPlatformArtifact(e));

// ------------------------------------------------------------------ baseline

/**
 * Identity excludes line/column so unrelated edits that shift lines don't read as
 * new errors. Counts guard against a genuine second instance in the same file.
 */
const identity = (e) => `${e.file}|${e.code}|${e.message}`;

function tally(list) {
  const m = {};
  for (const e of list) m[identity(e)] = (m[identity(e)] || 0) + 1;
  return m;
}

const current = tally(real);

if (UPDATE) {
  fs.writeFileSync(
    BASELINE,
    `${JSON.stringify(
      {
        note: 'Pre-existing typecheck debt. Generated by scripts/typecheck.mjs --update. New errors not listed here fail the gate; shrink this file, never grow it casually.',
        updatedAt: new Date().toISOString(),
        totalErrors: real.length,
        platformArtifactsExcluded: platformArtifacts.length,
        errors: current,
      },
      null,
      1
    )}\n`
  );
  console.log(`[typecheck] baseline updated: ${real.length} errors recorded`);
  console.log(`[typecheck] ${platformArtifacts.length} .platform artifacts excluded structurally`);
  process.exit(0);
}

let baseline = { errors: {} };
if (fs.existsSync(BASELINE)) {
  baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
} else {
  console.error(`[typecheck] no baseline at ${path.relative(ROOT, BASELINE)}`);
  console.error('[typecheck] create one with: node scripts/typecheck.mjs --update');
  process.exit(1);
}

const base = baseline.errors || {};

/** Report (current - allowed) instances for any identity that grew. */
const regressions = [];
const emitted = new Map();
for (const e of real) {
  const id = identity(e);
  const allowed = base[id] || 0;
  const already = emitted.get(id) || 0;
  if (already >= allowed) regressions.push(e);
  emitted.set(id, already + 1);
}

const fixed = Object.keys(base).filter((id) => !current[id]);

// -------------------------------------------------------------------- report

console.log(`[typecheck] ${real.length} errors (baseline ${baseline.totalErrors ?? Object.keys(base).length})`);
console.log(`[typecheck] ${platformArtifacts.length} .platform resolution artifacts excluded structurally`);

if (fixed.length) {
  console.log(`[typecheck] ${fixed.length} baselined error(s) no longer present — run --update to shrink the baseline`);
}

if (regressions.length) {
  console.error(`\n[typecheck] FAIL — ${regressions.length} new error(s):\n`);
  for (const e of regressions.slice(0, 50)) {
    console.error(`  ${e.file}(${e.line},${e.col}): ${e.code}: ${e.message}`);
  }
  if (regressions.length > 50) console.error(`  … and ${regressions.length - 50} more`);
  console.error('');
  process.exit(1);
}

console.log('[typecheck] PASS — no new type errors');
