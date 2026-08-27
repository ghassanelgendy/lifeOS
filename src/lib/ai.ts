import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { useUIStore } from '../stores/useUIStore';
import { addSystemLog } from './logger';
import {
  getFallbackCandidates,
  recordModelSuccess,
  recordModelFailure,
  getModelStat,
  type FallbackCandidate,
  type AIProviderId,
  AI_PROVIDERS,
  ALL_MODELS,
} from './aiFallback';

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
    // 1. On native (iOS/Android), execute direct HTTPS request first via CapacitorHttp (bypasses browser CORS & proxies)
    const nativeEndpoint = `${cleanBaseUrl}/chat/completions`;
    try {
      const response = await CapacitorHttp.post({
        url: nativeEndpoint,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        },
        data: payload,
        connectTimeout: 12000,
        readTimeout: 30000,
      });

      if (response.status === 200) {
        let resData = response.data;
        if (typeof resData === 'string') {
          try {
            resData = JSON.parse(resData);
          } catch {}
        }
        const text = resData?.choices?.[0]?.message?.content || (typeof resData === 'string' ? resData : '');
        const latencyMs = Math.round(performance.now() - startTime);
        return { text, latencyMs };
      } else {
        const errorMsg = response.data?.error?.message || response.data?.error || response.data || `HTTP ${response.status}`;
        const err: any = new Error(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
        err.status = response.status;
        throw err;
      }
    } catch (nativeErr: any) {
      if (nativeErr?.status && nativeErr.status !== 502 && nativeErr.status !== 504) {
        throw nativeErr;
      }

      // Fallback: try proxy server if direct native fails
      const proxyEndpoint = 'https://life-os-tan.vercel.app/api/ai';
      const proxyResponse = await CapacitorHttp.post({
        url: proxyEndpoint,
        headers: {
          'Content-Type': 'application/json',
          'X-AI-Api-Key': apiKey,
          'X-AI-Base-Url': cleanBaseUrl,
        },
        data: payload,
        connectTimeout: 10000,
        readTimeout: 25000,
      });

      if (proxyResponse.status === 200) {
        let resData = proxyResponse.data;
        if (typeof resData === 'string') {
          try {
            resData = JSON.parse(resData);
          } catch {}
        }
        const text = resData?.choices?.[0]?.message?.content || (typeof resData === 'string' ? resData : '');
        const latencyMs = Math.round(performance.now() - startTime);
        return { text, latencyMs };
      } else {
        const errorMsg = proxyResponse.data?.error?.message || proxyResponse.data?.error || proxyResponse.data || `HTTP ${proxyResponse.status}`;
        const err: any = new Error(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
        err.status = proxyResponse.status;
        throw err;
      }
    }
  }

  // 2. Web Browser environment: execute via /api/ai proxy
  const proxyController = new AbortController();
  const proxyTimer = setTimeout(() => proxyController.abort(), 25000);
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
    // If proxy itself is unreachable (e.g. pure Vite dev server), attempt direct fetch
    const directEndpoint = `${cleanBaseUrl}/chat/completions`;
    const directController = new AbortController();
    const directTimer = setTimeout(() => directController.abort(), 25000);

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

  const isNative = Capacitor.isNativePlatform();
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
        throw new Error(`AI request failed on ${candidate.model}: ${errorMessage}`);
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
  const isNative = Capacitor.isNativePlatform();
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
    const res = await executeCandidateCompletion(candidate, payload, isNative);
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
