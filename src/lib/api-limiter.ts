/** ================================================================
 *  API EGRESS LIMITER — Emergency circuit breaker for Supabase
 *  ================================================================ */

/* ------------------------------------------------------------------
   Configuration (tune these at runtime via setBudgetMB / window.__LIFOS_API)
   ------------------------------------------------------------------ */

/** MB left in the Supabase billing cycle. */
let BUDGET_MB = 200;

/** Hard ceiling on total guesses — never trust estimates above this. */
const MAX_ESTIMATED_EGRESS_MB = 150;

/** Auto-replenish a sliver every N minutes (very conservative). */
const BUDGET_REFRESH_MIN = 60;

/** Max requests allowed in a 60-second sliding window. */
const MAX_REQ_PER_MIN = 80;

/** How long (ms) an in-flight promise is deduped. */
const DEDUPE_MS = 4_000;

/** Extra delay (ms) added to heavy-table reads during non-emergency. */
const HEAVY_TABLE_THROTTLE_MS = 800;

/** Tables whose *reads* are allowed even in emergency mode. */
const CRITICAL_READS = new Set([
  'tasks',
  'habits',
  'habit_logs',
  'prayer_habits',
  'prayer_logs',
  'tags',
  'task_lists',
  'transactions',          // finance mutations rely on reads for cache
  'investment_accounts',
  'points_transactions',   // points / gamification
  'calendar_events',
]);

/** Tables whose reads we throttle aggressively. */
const HEAVY_TABLES = new Set([
  'screentime_daily_app_stats',
  'screentime_daily_website_stats',
  'screentime_daily_summary',
  'sleep_stages',
  'inbody_scans',
]);

/* ------------------------------------------------------------------
   Mutable state
   ------------------------------------------------------------------ */

type Flight = { promise: Promise<Response>; ts: number };

const inFlight = new Map<string, Flight>();
const reqLog: number[] = []; // timestamps of completed requests

let totalEgressGuessMB = 0;
let lastBudgetRefresh = Date.now();
let _emergency = false;

/* ------------------------------------------------------------------
   Helpers
   ------------------------------------------------------------------ */

function now() { return Date.now(); }

function pruneReqLog() {
  const cutoff = now() - 60_000;
  while (reqLog.length && reqLog[0] < cutoff) reqLog.shift();
}

function estimatePayloadMB(url: string, body: BodyInit | null | undefined): number {
  let bytes = url.length * 2;
  if (body) {
    if (typeof body === 'string') bytes += body.length * 2;
    else if (body instanceof URLSearchParams) bytes += body.toString().length * 2;
    else if (body instanceof FormData) bytes += 2_000;
    else if (body instanceof Blob) bytes += body.size;
  }
  bytes += 1_200; // headers
  return bytes / 1024 / 1024;
}

function tableFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/');
    const idx = parts.indexOf('v1');
    if (idx !== -1 && parts[idx + 1]) return parts[idx + 1];
  } catch { /* ignore */ }
  return null;
}

function isCritical(url: string, method: string): boolean {
  const table = tableFromUrl(url);
  if (!table) return true; // auth, realtime, edge functions
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') return true;
  return CRITICAL_READS.has(table);
}

function isHeavyTable(url: string): boolean {
  const table = tableFromUrl(url);
  return table ? HEAVY_TABLES.has(table) : false;
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

/* ------------------------------------------------------------------
   Public API
   ------------------------------------------------------------------ */

export function setBudgetMB(n: number) {
  BUDGET_MB = Math.max(0, n);
  lastBudgetRefresh = now();
  checkEmergency();
}

export function resetEgressCounter() {
  totalEgressGuessMB = 0;
  _emergency = false;
  console.warn('[API-LIMITER] 🔄 Egress counter & emergency reset');
}

export function getStatus() {
  pruneReqLog();
  return {
    emergency: _emergency,
    budgetMB: BUDGET_MB,
    estimatedUsedMB: Number(totalEgressGuessMB.toFixed(2)),
    requestsLastMin: reqLog.length,
    inFlightCount: inFlight.size,
  } as const;
}

function checkEmergency(): boolean {
  pruneReqLog();

  const elapsedMin = (now() - lastBudgetRefresh) / 60_000;
  if (elapsedMin >= BUDGET_REFRESH_MIN) {
    BUDGET_MB = Math.min(200, BUDGET_MB + 5);
    lastBudgetRefresh = now();
  }

  const shouldEmergency =
    totalEgressGuessMB >= Math.min(BUDGET_MB * 0.75, MAX_ESTIMATED_EGRESS_MB) ||
    reqLog.length >= MAX_REQ_PER_MIN;

  if (shouldEmergency && !_emergency) {
    console.warn(
      `%c[API-LIMITER] 🔴 EMERGENCY ON — est ${totalEgressGuessMB.toFixed(1)}MB of ${BUDGET_MB}MB · ${reqLog.length} req/min`,
      'background:#b91c1c;color:#fff;padding:2px 6px;border-radius:4px;'
    );
    _emergency = true;
  }

  if (!shouldEmergency && _emergency) {
    console.warn(
      `%c[API-LIMITER] 🟢 Emergency OFF — est ${totalEgressGuessMB.toFixed(1)}MB of ${BUDGET_MB}MB · ${reqLog.length} req/min`,
      'background:#15803d;color:#fff;padding:2px 6px;border-radius:4px;'
    );
    _emergency = false;
  }

  return _emergency;
}

/* ------------------------------------------------------------------
   Fetch interceptor (the main gate)
   ------------------------------------------------------------------ */

let _originalFetch: typeof fetch | undefined;

export function installApiLimiter() {
  if (_originalFetch) return; // already installed

  _originalFetch = globalThis.fetch;

  globalThis.fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method ?? 'GET').toUpperCase();

    /* ---- 1. Budget gate ---- */
    checkEmergency();

    if (_emergency && !isCritical(url, method)) {
      console.warn(`[API-LIMITER] BLOCKED non-critical ${method} ${url}`);
      return new Response(
        JSON.stringify({
          message: 'API egress limiter: non-critical request blocked to preserve budget.',
          code: 'EGRESS_LIMIT',
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }

    /* ---- 2. Rate-limit pure reads on heavy tables ---- */
    if (!_emergency && method === 'GET' && isHeavyTable(url)) {
      console.warn(`[API-LIMITER] THROTTLE heavy table read — ${url}`);
      await sleep(HEAVY_TABLE_THROTTLE_MS);
    }

    /* ---- 3. Deduplication ---- */
    const dedupeKey = `${method} ${url} ${JSON.stringify(init?.body ?? '')}`;
    const existing = inFlight.get(dedupeKey);
    if (existing && now() - existing.ts < DEDUPE_MS) {
      console.warn(`[API-LIMITER] DEDUPE ${method} ${tableFromUrl(url) ?? ''}`);
      return existing.promise.then(async (res) => res.clone());
    }

    /* ---- 4. Sliding-window rate limit ---- */
    pruneReqLog();
    const isCriticalReq = isCritical(url, method);
    if (!isCriticalReq && reqLog.length >= MAX_REQ_PER_MIN) {
      const oldest = reqLog[0];
      const wait = 60_000 - (now() - oldest) + 50;
      console.warn(`[API-LIMITER] RATE-LIMIT sleep ${wait}ms`);
      await sleep(Math.max(wait, 0));
      pruneReqLog();
    }

    /* ---- 5. Execute + track ---- */
    const start = now();
    const promise = _originalFetch!(input, init)
      .then(async (response) => {
        // account for egress on every completed request
        const guess = estimatePayloadMB(url, init?.body);
        totalEgressGuessMB += guess;
        reqLog.push(now());

        // keep arrays bounded
        if (reqLog.length > 300) reqLog.splice(0, reqLog.length - 300);
        if (inFlight.size > 100) {
          const cutoff = now() - DEDUPE_MS;
          for (const [k, v] of inFlight) {
            if (v.ts < cutoff) inFlight.delete(k);
          }
        }

        // fire emergency check asynchronously — don't delay response
        Promise.resolve().then(() => checkEmergency());

        return response;
      })
      .catch((err) => {
        // still count the attempt
        reqLog.push(now());
        throw err;
      });

    inFlight.set(dedupeKey, { promise, ts: start });

    // Auto-cleanup dedupe entry after window expires
    promise.finally(() => {
      setTimeout(() => {
        const cur = inFlight.get(dedupeKey);
        if (cur && cur.ts === start) inFlight.delete(dedupeKey);
      }, DEDUPE_MS);
    });

    return promise;
  };

  console.warn(
    '%c[API-LIMITER] ✅ installed · budget=%sMB · maxReq/min=%s · dedupeMs=%s',
    'background:#0369a1;color:#fff;padding:2px 6px;border-radius:4px;',
    BUDGET_MB,
    MAX_REQ_PER_MIN,
    DEDUPE_MS
  );

  // Expose manual controls on window for debugging
  if (typeof window !== 'undefined') {
    (window as any).__LIFEOS_API = {
      setBudgetMB,
      resetEgressCounter,
      getStatus,
      unblock: () => { _emergency = false; totalEgressGuessMB = 0; },
    };
  }
}

export function uninstallApiLimiter() {
  if (_originalFetch) {
    globalThis.fetch = _originalFetch;
    _originalFetch = undefined;
    console.warn('[API-LIMITER] ❌ uninstalled');
  }
}
