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
 * Executes a single chat completion request against a specific candidate model and provider.
 */
async function executeCandidateCompletion(
  candidate: FallbackCandidate,
  payload: any,
  isNative: boolean
): Promise<CompletionResult> {
  const startTime = performance.now();
  const cleanBaseUrl = candidate.baseUrl.trim().replace(/\/+$/, '');
  const apiKey = candidate.apiKey.trim();

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
      const response = await CapacitorHttp.post({
        url: nativeEndpoint,
        headers: nativeHeaders,
        data: payload,
        connectTimeout: 15000,
        readTimeout: 40000,
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
      // If error is 429/401/402/404, propagate directly so the smart fallback engine cascades
      if (nativeErr?.status && (nativeErr.status === 429 || nativeErr.status === 401 || nativeErr.status === 402 || nativeErr.status === 404)) {
        throw nativeErr;
      }

      // 2. Secondary fallback: direct web fetch from WebView
      try {
        const directController = new AbortController();
        const directTimer = setTimeout(() => directController.abort(), 20000);
        const directResponse = await fetch(nativeEndpoint, {
          method: 'POST',
          signal: directController.signal,
          headers: nativeHeaders,
          body: JSON.stringify(payload),
        });
        clearTimeout(directTimer);

        if (directResponse.ok) {
          const directData = await directResponse.json();
          const text = directData?.choices?.[0]?.message?.content || '';
          if (text) {
            const latencyMs = Math.round(performance.now() - startTime);
            return { text, latencyMs };
          }
        }
      } catch {}

      throw nativeErr;
    }
  }

  // 2. Web Browser environment: execute via /api/ai proxy
  const proxyController = new AbortController();
  const proxyTimer = setTimeout(() => proxyController.abort(), 60000);
  let proxyResponse;

  try {
    proxyResponse = await fetch('/api/ai', {
      method: 'POST',
      signal: proxyController.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-AI-Api-Key': apiKey,
        'X-AI-Base-Url': cleanBaseUrl,
      },
      body: JSON.stringify(payload),
    });
    clearTimeout(proxyTimer);
  } catch (netErr: any) {
    clearTimeout(proxyTimer);
    
    // If proxy failed and the domain is known to block CORS in browsers, fail fast to candidate router
    if (cleanBaseUrl.includes('bynara.id')) {
      throw new Error(`Proxy unreachable for ${cleanBaseUrl}: ${netErr.message || netErr}`, { cause: netErr });
    }

    // Otherwise attempt direct fetch
    const directEndpoint = `${cleanBaseUrl}/chat/completions`;
    const directController = new AbortController();
    const directTimer = setTimeout(() => directController.abort(), 45000);

    try {
      const directResponse = await fetch(directEndpoint, {
        method: 'POST',
        signal: directController.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });
      clearTimeout(directTimer);

      if (!directResponse.ok) {
        const errorBody = await directResponse.text().catch(() => '');
        let errMsg = `HTTP ${directResponse.status}`;
        try {
          const parsed = JSON.parse(errorBody);
          errMsg = parsed.error?.message || parsed.error || parsed.message || errMsg;
        } catch {
          if (errorBody) errMsg = errorBody;
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
      clearTimeout(directTimer);
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
      if (errorText) errMsg = errorText;
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
  jsonMode = false
): Promise<string> {
  const store = useUIStore.getState();
  const {
    aiEnabled,
    aiApiKey,
    aiBaseUrl,
    aiModel,
    aiBynaraApiKey,
    aiDahlApiKey,
    aiFallbackEnabled = true,
  } = store;

  if (!aiEnabled) {
    addSystemLog('askAI aborted: AI Integration is disabled in Settings', 'warn');
    throw new Error('AI Integration is currently disabled. Enable it in Settings.');
  }

  // Get prioritized fallback candidate list based on health scores and active cooldowns
  const candidates = getFallbackCandidates({
    selectedModel: aiModel,
    customBaseUrl: aiBaseUrl,
    customApiKey: aiApiKey,
    dahlApiKey: aiDahlApiKey,
    bynaraApiKey: aiBynaraApiKey,
    fallbackEnabled: aiFallbackEnabled,
  });

  if (candidates.length === 0) {
    throw new Error('No AI model candidates available. Please configure your API keys in Settings.');
  }

  const isNative = isNativeOrDesktop();
  addSystemLog(`askAI starting: ${candidates.length} candidate models in queue (FallbackEnabled=${aiFallbackEnabled}, Native=${isNative})`, 'info');

  const failureLog: Array<{ model: string; provider: string; status: number | null; error: string }> = [];

  // Filter candidates: try healthy models first, neglect models in cooldown
  const healthyCandidates = candidates.filter((c) => !c.inCooldown);
  const executionQueue = healthyCandidates.length > 0 ? healthyCandidates : candidates;

  for (let i = 0; i < executionQueue.length; i++) {
    const candidate = executionQueue[i];
    const payload: any = {
      model: candidate.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
    };

    if (jsonMode) {
      payload.response_format = { type: 'json_object' };
    }

    addSystemLog(
      `askAI attempt [${i + 1}/${executionQueue.length}]: model=${candidate.model} (${candidate.provider}, score=${candidate.score})`,
      'info'
    );

    try {
      const result = await executeCandidateCompletion(candidate, payload, isNative);
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
        throw new Error(`AI request failed on ${candidate.model}: ${errorMessage}`, { cause: err });
      }
    }
  }

  // All candidates in the queue failed
  const summary = failureLog.map((f) => `${f.model} (${f.status || 'ERR'}): ${f.error}`).join(' | ');
  const finalError = `All AI models in the fallback chain failed (${failureLog.length} attempted). Details: ${summary}`;
  addSystemLog(`askAI exhausted: ${finalError}`, 'error');
  throw new Error(finalError);
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
    onProgress?: (modelId: string, current: number, total: number, result: any) => void;
  } = {}
) {
  const dahlKey = (options.dahlApiKey || '').trim() || AI_PROVIDERS.dahl.defaultApiKey;
  const bynaraKey = (options.bynaraApiKey || '').trim() || AI_PROVIDERS.bynara.defaultApiKey;

  const results: Record<string, { ok: boolean; status: number; latencyMs: number; error?: string }> = {};
  const total = ALL_MODELS.length;

  for (let i = 0; i < total; i++) {
    const m = ALL_MODELS[i];
    const key = m.provider === 'dahl' ? dahlKey : bynaraKey;
    const url = m.provider === 'dahl' ? AI_PROVIDERS.dahl.baseUrl : AI_PROVIDERS.bynara.baseUrl;

    const res = await testSingleModel(m.id, m.provider, key, url);
    results[m.id] = res;

    if (options.onProgress) {
      options.onProgress(m.id, i + 1, total, res);
    }
  }

  return results;
}
