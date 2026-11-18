import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { useUIStore } from '../stores/useUIStore';
import { addSystemLog } from './logger';
import { getFallbackCandidates, recordModelSuccess, recordModelFailure, type FallbackCandidate, type AIProviderId, AI_PROVIDERS, ALL_MODELS } from './aiFallback';

/**
 * True for iOS/Android (Capacitor.isNativePlatform()) AND for the Pake/Tauri
 * desktop build. Both need to call AI providers directly (or via the native
 * HTTP bridge) instead of the `/api/ai` proxy path below — that path only
 * exists as a Vercel serverless function on the hosted web app's own origin,
 * so it 404s from any desktop build (no server behind `tauri://localhost`),
 * which is why the AI Assistant silently never got a response on desktop.
 */
function isNativeOrDesktop(): boolean {
  return Capacitor.isNativePlatform() || (typeof window !== 'undefined' && !!(window as any).__TAURI__);
}

/**
 * Standard helper to clean AI responses (strips <think> reasoning tags).
 */
export function cleanAiResponse(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

/**
 * Utility helper to clean and extract JSON from AI text responses in case markdown fences are returned.
 */
export function extractJSON(text: string): any {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\n/, '').replace(/\n```$/, '');
  }
  return JSON.parse(cleaned.trim());
}

interface CompletionResult {
  text: string;
  latencyMs: number;
}

/**
 * Upstream gateways (Cloudflare, load balancers, timeouts) sometimes respond with a full
 * HTML error page instead of JSON on 5xx/504s. That text ends up as the Error message shown
 * in the chat UI, which renders assistant content through markdown-to-HTML and injects it
 * with dangerouslySetInnerHTML — so embedding raw HTML verbatim plants foreign
 * <style>/<script>/<html> markup into the live page and corrupts its styling. Never let
 * upstream error bodies that look like HTML reach the UI unfiltered.
 */
function sanitizeUpstreamErrorText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  if (/^<!doctype html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed) || /<\/?(script|style|body|head|html)[\s>]/i.test(trimmed)) {
    return 'The AI provider returned an unexpected (non-JSON) error page.';
  }
  return trimmed.length > 500 ? `${trimmed.slice(0, 500)}…` : trimmed;
}

/** Exact/subdomain hostname match against a base URL -- unlike a raw `.includes(domain)`
 * check, this can't be fooled by a lookalike host such as `evil.com/bynara.id`. */
function hostnameMatchesDomain(baseUrl: string | null | undefined, domain: string): boolean {
  if (!baseUrl) return false;
  try {
    const hostname = new URL(baseUrl).hostname.toLowerCase();
    return hostname === domain || hostname.endsWith(`.${domain}`);
  } catch {
    return false;
  }
}

export interface AskAIOptions {
  /** Override request timeout in milliseconds (e.g., 3500 for onboarding). */
  timeoutMs?: number;
  /** External AbortSignal to cancel in-flight requests cleanly. */
  signal?: AbortSignal;
  /** Prioritize `fast` tier models ahead of heavier flagship models. */
  preferFastTier?: boolean;
  /** Cap the number of fallback candidates tried. */
  maxCandidates?: number;
  /** Cap response token length for faster completions. */
  maxTokens?: number;
  /** On hosted Web, allow trying `/api/ai` even when no client BYOK key is configured. */
  allowProxyFallback?: boolean;
  /** Override temperature (defaults to 0.1). */
  temperature?: number;
}

function createAbortError(): Error {
  const err = new Error('AI request aborted');
  err.name = 'AbortError';
  return err;
}

function createMergedSignal(timeoutMs: number, externalSignal?: AbortSignal): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const onExternalAbort = () => controller.abort(externalSignal?.reason ?? createAbortError());

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort(externalSignal.reason ?? createAbortError());
    } else {
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }
  }

  const timer = setTimeout(() => controller.abort(new Error(`AI request timed out after ${timeoutMs}ms`)), timeoutMs);

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      if (externalSignal) {
        externalSignal.removeEventListener('abort', onExternalAbort);
      }
    },
  };
}

/**
 * Executes a single chat completion request against a specific candidate model and provider.
 */
async function executeCandidateCompletion(
  candidate: FallbackCandidate,
  payload: any,
  isNative: boolean,
  options?: { timeoutMs?: number; signal?: AbortSignal }
): Promise<CompletionResult> {
  const startTime = performance.now();
  const cleanBaseUrl = candidate.baseUrl.trim().replace(/\/+$/, '');
  const apiKey = candidate.apiKey.trim();
  const timeoutMs = options?.timeoutMs ?? 60000;
  const externalSignal = options?.signal;

  if (externalSignal?.aborted) {
    throw createAbortError();
  }

  if (isNative) {
    const nativeEndpoint = `${cleanBaseUrl}/chat/completions`;
    const nativeHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/plain, */*',
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 lifeOS/1.0',
    };
    if (apiKey) {
      nativeHeaders['Authorization'] = `Bearer ${apiKey}`;
    }

    // 1. Primary on Native: direct native HTTPS request via CapacitorHttp (bypasses CORS with zero intermediate hops)
    try {
      const capPromise = CapacitorHttp.post({
        url: nativeEndpoint,
        headers: nativeHeaders,
        data: payload,
        connectTimeout: Math.min(15000, timeoutMs),
        readTimeout: Math.min(40000, timeoutMs),
      });

      const response = await new Promise<Awaited<typeof capPromise>>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`AI request timed out after ${timeoutMs}ms`)), timeoutMs);
        const onAbort = () => {
          clearTimeout(timer);
          reject(createAbortError());
        };
        if (externalSignal) {
          if (externalSignal.aborted) {
            clearTimeout(timer);
            reject(createAbortError());
            return;
          }
          externalSignal.addEventListener('abort', onAbort, { once: true });
        }
        capPromise.then(
          (res) => {
            clearTimeout(timer);
            externalSignal?.removeEventListener('abort', onAbort);
            resolve(res);
          },
          (err) => {
            clearTimeout(timer);
            externalSignal?.removeEventListener('abort', onAbort);
            reject(err);
          }
        );
      });

      let resData = response.data;
      if (typeof resData === 'string') {
        try {
          resData = JSON.parse(resData);
        } catch {}
      }

      if (response.status >= 200 && response.status < 300) {
        const text = resData?.choices?.[0]?.message?.content || (typeof resData === 'string' ? resData : '');
        if (text) {
          const latencyMs = Math.round(performance.now() - startTime);
          return { text, latencyMs };
        }
      }

      const errMsg =
        resData?.error?.message ||
        resData?.error ||
        resData?.message ||
        (typeof resData === 'string' ? resData : JSON.stringify(resData)) ||
        `HTTP ${response.status}`;
      const err: any = new Error(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg));
      err.status = response.status;
      throw err;
    } catch (nativeErr: any) {
      if (externalSignal?.aborted || nativeErr?.name === 'AbortError') {
        throw nativeErr;
      }
      // If error is 429/401/402/404, propagate directly so the smart fallback engine cascades
      if (nativeErr?.status && (nativeErr.status === 429 || nativeErr.status === 401 || nativeErr.status === 402 || nativeErr.status === 404)) {
        throw nativeErr;
      }

      // 2. Secondary fallback: direct web fetch from WebView
      const { signal: directSignal, cleanup: cleanupDirect } = createMergedSignal(Math.min(20000, timeoutMs), externalSignal);
      try {
        const directResponse = await fetch(nativeEndpoint, {
          method: 'POST',
          signal: directSignal,
          headers: nativeHeaders,
          body: JSON.stringify(payload),
        });
        cleanupDirect();

        if (directResponse.ok) {
          const directData = await directResponse.json();
          const text = directData?.choices?.[0]?.message?.content || '';
          if (text) {
            const latencyMs = Math.round(performance.now() - startTime);
            return { text, latencyMs };
          }
        }
      } catch {
        cleanupDirect();
      }

      throw nativeErr;
    }
  }

  // 2. Web Browser environment: execute via /api/ai proxy
  const { signal: proxySignal, cleanup: cleanupProxy } = createMergedSignal(timeoutMs, externalSignal);
  let proxyResponse;

  try {
    proxyResponse = await fetch('/api/ai', {
      method: 'POST',
      signal: proxySignal,
      headers: {
        'Content-Type': 'application/json',
        'X-AI-Api-Key': apiKey,
        'X-AI-Base-Url': cleanBaseUrl,
      },
      body: JSON.stringify(payload),
    });
    cleanupProxy();
  } catch (netErr: any) {
    cleanupProxy();
    if (externalSignal?.aborted || netErr?.name === 'AbortError') {
      throw netErr;
    }
    
    // If proxy failed and the domain is known to block CORS in browsers, fail fast to candidate router
    if (hostnameMatchesDomain(cleanBaseUrl, 'bynara.id')) {
      throw new Error(`Proxy unreachable for ${cleanBaseUrl}: ${netErr.message || netErr}`, { cause: netErr });
    }

    // Otherwise attempt direct fetch
    const directEndpoint = `${cleanBaseUrl}/chat/completions`;
    const { signal: directSignal, cleanup: cleanupDirect } = createMergedSignal(Math.min(45000, timeoutMs), externalSignal);

    try {
      const directResponse = await fetch(directEndpoint, {
        method: 'POST',
        signal: directSignal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });
      cleanupDirect();

      if (!directResponse.ok) {
        const errorBody = await directResponse.text().catch(() => '');
        let errMsg = `HTTP ${directResponse.status}`;
        try {
          const parsed = JSON.parse(errorBody);
          errMsg = parsed.error?.message || parsed.error || parsed.message || errMsg;
        } catch {
          const sanitized = sanitizeUpstreamErrorText(errorBody);
          if (sanitized) errMsg = sanitized;
        }
        const err: any = new Error(errMsg);
        err.status = directResponse.status;
        throw err;
      }

      const directData = await directResponse.json();
      const text = directData?.choices?.[0]?.message?.content || '';
      const latencyMs = Math.round(performance.now() - startTime);
      return { text, latencyMs };
    } catch (directErr: any) {
      cleanupDirect();
      throw directErr;
    }
  }

  if (!proxyResponse.ok) {
    const errorText = await proxyResponse.text().catch(() => '');
    let errMsg = `HTTP ${proxyResponse.status}`;
    try {
      const parsed = JSON.parse(errorText);
      errMsg = parsed.error?.message || parsed.error || parsed.message || errMsg;
    } catch {
      const sanitized = sanitizeUpstreamErrorText(errorText);
      if (sanitized) errMsg = sanitized;
    }
    const err: any = new Error(errMsg);
    err.status = proxyResponse.status;
    throw err;
  }

  const data = await proxyResponse.json();
  const text = data?.choices?.[0]?.message?.content || '';
  const latencyMs = Math.round(performance.now() - startTime);
  return { text, latencyMs };
}

/**
 * Main AI Completion function with Smart Fallback, Cooldown Management, and Best-Model Memory.
 */
export async function askAI(
  systemPrompt: string,
  userPrompt: string,
  jsonMode = false,
  options?: AskAIOptions
): Promise<string> {
  const store = useUIStore.getState();
  const {
    aiEnabled,
    aiApiKey,
    aiBaseUrl,
    aiModel,
    aiBynaraApiKey,
    aiDahlApiKey,
    aiGroqApiKey,
    aiFallbackEnabled = true,
  } = store;

  const isNative = isNativeOrDesktop();
  const canUseProxyFallback = Boolean(options?.allowProxyFallback && !isNative);

  if (!aiEnabled && !canUseProxyFallback) {
    addSystemLog('askAI aborted: AI Integration is disabled in Settings', 'warn');
    throw new Error('AI Integration is currently disabled. Enable it in Settings.');
  }

  if (options?.signal?.aborted) {
    throw createAbortError();
  }

  // Get prioritized fallback candidate list based on health scores and active cooldowns
  const candidates = getFallbackCandidates({
    selectedModel: aiModel,
    customBaseUrl: aiBaseUrl,
    customApiKey: aiApiKey,
    dahlApiKey: aiDahlApiKey,
    bynaraApiKey: aiBynaraApiKey,
    groqApiKey: aiGroqApiKey,
    fallbackEnabled: aiFallbackEnabled,
  });

  if (candidates.length === 0) {
    throw new Error('No AI model candidates available. Please configure your API keys in Settings.');
  }

  // Filter candidates: try healthy models first, neglect models in cooldown
  const healthyCandidates = candidates.filter((c) => !c.inCooldown);
  let executionQueue = healthyCandidates.length > 0 ? [...healthyCandidates] : [...candidates];

  if (options?.preferFastTier) {
    executionQueue.sort((a, b) => {
      const aFast = a.tier === 'fast' ? 1 : 0;
      const bFast = b.tier === 'fast' ? 1 : 0;
      if (aFast !== bFast) return bFast - aFast;
      return b.score - a.score;
    });
  }

  if (typeof options?.maxCandidates === 'number' && options.maxCandidates > 0) {
    executionQueue = executionQueue.slice(0, options.maxCandidates);
  }

  addSystemLog(
    `askAI starting: ${executionQueue.length} candidate models in queue (FallbackEnabled=${aiFallbackEnabled}, Native=${isNative})`,
    'info'
  );

  const failureLog: Array<{ model: string; provider: string; status: number | null; error: string }> = [];

  for (let i = 0; i < executionQueue.length; i++) {
    if (options?.signal?.aborted) {
      throw createAbortError();
    }

    const candidate = executionQueue[i];
    const payload: any = {
      model: candidate.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: options?.temperature ?? 0.1,
    };

    if (typeof options?.maxTokens === 'number' && options.maxTokens > 0) {
      payload.max_tokens = options.maxTokens;
    }

    if (jsonMode) {
      payload.response_format = { type: 'json_object' };
    }

    addSystemLog(
      `askAI attempt [${i + 1}/${executionQueue.length}]: model=${candidate.model} (${candidate.provider}, score=${candidate.score})`,
      'info'
    );

    try {
      const result = await executeCandidateCompletion(candidate, payload, isNative, {
        timeoutMs: options?.timeoutMs,
        signal: options?.signal,
      });
      const cleaned = cleanAiResponse(result.text);

      if (!cleaned) {
        throw new Error('Received empty completion response from model');
      }

      // Record successful run & save model as the best working model
      recordModelSuccess(candidate.model, candidate.provider, result.latencyMs);
      store.setAiActiveModel(candidate.model);

      addSystemLog(
        `askAI success: model=${candidate.model} (${candidate.provider}) responded in ${result.latencyMs}ms (length=${cleaned.length})`,
        'info'
      );

      return cleaned;
    } catch (err: any) {
      if (options?.signal?.aborted || err?.name === 'AbortError') {
        throw err;
      }

      const statusCode = typeof err?.status === 'number' ? err.status : (err?.message?.match(/\b(429|402|404|400|500|502|503|504)\b/)?.[1] ? parseInt(err.message.match(/\b(429|402|404|400|500|502|503|504)\b/)[1]) : null);
      const errorMessage = err?.message || String(err);

      // Record failure and set cooldown penalty (neglect model for next attempts)
      recordModelFailure(candidate.model, candidate.provider, statusCode, errorMessage);
      failureLog.push({
        model: candidate.model,
        provider: candidate.provider,
        status: statusCode,
        error: errorMessage,
      });

      addSystemLog(
        `askAI fallback trigger: model=${candidate.model} failed (status=${statusCode || 'unknown'}, err=${errorMessage.slice(0, 100)}). Trying next candidate...`,
        'warn'
      );

      // If user disabled fallback, do not cascade
      if (!aiFallbackEnabled) {
        const kind = statusCode !== null ? 'API error' : 'app/network error';
        throw new Error(`AI request failed on ${candidate.model} — ${kind} (${statusCode ?? 'no HTTP response'}): ${errorMessage}`, { cause: err });
      }
    }
  }

  // All candidates in the queue failed. Classify each failure so the user (and the error
  // shown in Chat) can tell an API-side problem (the provider responded with an HTTP error,
  // e.g. 401/429/500) apart from an app-side one (timeout/network/parsing failure before any
  // HTTP response came back — e.g. a client-side abort, or the Vercel function itself being
  // killed before the model finished responding).
  const apiErrors = failureLog.filter((f) => f.status !== null);
  const appErrors = failureLog.filter((f) => f.status === null);
  const kind = apiErrors.length > 0 && appErrors.length === 0
    ? 'API error'
    : appErrors.length > 0 && apiErrors.length === 0
      ? 'app/network error'
      : 'mixed API + app/network errors';
  const summary = failureLog.map((f) => `${f.model} (${f.status ?? 'no HTTP response'}): ${f.error}`).join(' | ');
  const finalError = `All AI models in the fallback chain failed — ${kind} (${failureLog.length} attempted). Details: ${summary}`;
  addSystemLog(`askAI exhausted: ${finalError}`, 'error');
  throw new Error(finalError);
}

/**
 * Bounded fast-tier AI completion helper for latency-sensitive UI flows (e.g. onboarding).
 * Prioritizes fast models, limits fallback cascades, and enforces a strict timeout budget.
 */
export async function askAIFast(
  systemPrompt: string,
  userPrompt: string,
  options: Omit<AskAIOptions, 'preferFastTier'> & { jsonMode?: boolean } = {}
): Promise<string> {
  const { jsonMode = false, timeoutMs = 3500, maxCandidates = 2, maxTokens = 700, ...rest } = options;
  return askAI(systemPrompt, userPrompt, jsonMode, {
    ...rest,
    timeoutMs,
    maxCandidates,
    maxTokens,
    preferFastTier: true,
  });
}

/**
 * Ping / Test a single model to check its health, latency, and capability.
 */
export async function testSingleModel(
  modelId: string,
  providerId: AIProviderId,
  apiKey: string,
  baseUrl: string
): Promise<{ ok: boolean; status: number; latencyMs: number; error?: string }> {
  const isNative = isNativeOrDesktop();
  const startTime = performance.now();

  const candidate: FallbackCandidate = {
    model: modelId,
    provider: providerId,
    baseUrl,
    apiKey,
    score: 100,
    inCooldown: false,
    tier: 'test',
    name: modelId,
  };

  const payload = {
    model: modelId,
    messages: [{ role: 'user', content: 'Ping. Reply with "pong".' }],
    max_tokens: 10,
    temperature: 0.1,
  };

  try {
    await executeCandidateCompletion(candidate, payload, isNative);
    const latencyMs = Math.round(performance.now() - startTime);
    recordModelSuccess(modelId, providerId, latencyMs);
    return { ok: true, status: 200, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    const status = typeof err?.status === 'number' ? err.status : 500;
    const errorMsg = err?.message || String(err);
    recordModelFailure(modelId, providerId, status, errorMsg);
    return { ok: false, status, latencyMs, error: errorMsg };
  }
}

/**
 * Test all models in the catalog and update health benchmarks.
 */
export async function testAllCatalogModels(
  options: {
    dahlApiKey?: string;
    bynaraApiKey?: string;
    groqApiKey?: string;
    onProgress?: (modelId: string, current: number, total: number, result: any) => void;
  } = {}
) {
  const dahlKey = (options.dahlApiKey || '').trim() || AI_PROVIDERS.dahl.defaultApiKey;
  const bynaraKey = (options.bynaraApiKey || '').trim() || AI_PROVIDERS.bynara.defaultApiKey;
  const groqKey = (options.groqApiKey || '').trim() || AI_PROVIDERS.groq.defaultApiKey;

  const results: Record<string, { ok: boolean; status: number; latencyMs: number; error?: string }> = {};
  const total = ALL_MODELS.length;

  for (let i = 0; i < total; i++) {
    const m = ALL_MODELS[i];
    const key = m.provider === 'dahl' ? dahlKey : m.provider === 'groq' ? groqKey : bynaraKey;
    const url = m.provider === 'dahl' ? AI_PROVIDERS.dahl.baseUrl : m.provider === 'groq' ? AI_PROVIDERS.groq.baseUrl : AI_PROVIDERS.bynara.baseUrl;

    const res = await testSingleModel(m.id, m.provider, key, url);
    results[m.id] = res;

    if (options.onProgress) {
      options.onProgress(m.id, i + 1, total, res);
    }
  }

  return results;
}
