import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { useUIStore } from '../stores/useUIStore';
import { addSystemLog } from './logger';

/**
 * Standard client helper to perform OpenAI-compatible chat completions.
 * Connects to the user-defined base URL and API key inside useUIStore.
 */
export async function askAI(
  systemPrompt: string,
  userPrompt: string,
  jsonMode = false
): Promise<string> {
  const { aiEnabled, aiApiKey, aiBaseUrl, aiModel } = useUIStore.getState();

  const keyDisplay = aiApiKey ? `${aiApiKey.trim().slice(0, 5)}... (len: ${aiApiKey.trim().length})` : 'none';
  addSystemLog(`askAI initiated: model=${aiModel}, baseUrl=${aiBaseUrl}, key=${keyDisplay}, jsonMode=${jsonMode}`, 'info');

  if (!aiEnabled) {
    addSystemLog('askAI aborted: AI Integration is disabled in Settings', 'warn');
    throw new Error('AI Integration is currently disabled. Enable it in Settings.');
  }
  if (!aiApiKey) {
    addSystemLog('askAI aborted: AI API Key is missing in Settings', 'warn');
    throw new Error('AI API Key is missing. Please set your key in Settings.');
  }

  const cleanBaseUrl = aiBaseUrl.trim().replace(/\/+$/, '');
  const payload: any = {
    model: aiModel,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.1,
  };

  // If jsonMode is requested, enforce it if using compatible models
  if (jsonMode) {
    payload.response_format = { type: 'json_object' };
  }

  // Use CapacitorHttp only on real native iOS/Android (bypasses CORS in WKWebView).
  // In browser/localhost, plain fetch works fine — no CORS restriction.
  const isNative = Capacitor.isNativePlatform();
  addSystemLog(`askAI environment check: isNativePlatform=${isNative}`, 'info');

  if (isNative) {
    const nativeEndpoint = `${cleanBaseUrl}/chat/completions`;
    addSystemLog(`askAI executing CapacitorHttp POST to endpoint: ${nativeEndpoint}`, 'info');
    try {
      const response = await CapacitorHttp.post({
        url: nativeEndpoint,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${aiApiKey.trim()}`,
        },
        data: JSON.stringify(payload), // must be string for WKWebView bridge
      });

      addSystemLog(`askAI CapacitorHttp completed: status=${response.status}`, 'info');

      if (response.status !== 200) {
        const errorMsg = response.data?.error?.message || response.data || 'Unknown native error';
        const errLog = `AI Router Error (${response.status}): ${JSON.stringify(errorMsg)}`;
        addSystemLog(errLog, 'error');
        throw new Error(errLog);
      }

      let resData = response.data;
      if (typeof resData === 'string') {
        try {
          resData = JSON.parse(resData);
        } catch {
          // ignore
        }
      }

      const text = resData?.choices?.[0]?.message?.content || (typeof resData === 'string' ? resData : '');
      addSystemLog(`askAI CapacitorHttp success: response length=${text.length}`, 'info');
      return text.trim();
    } catch (err: any) {
      addSystemLog(`askAI CapacitorHttp failed with exception: ${err.message || err}`, 'error');
      throw err;
    }
  }

  // Web Browser environment: execute via /api/ai proxy to avoid CORS
  addSystemLog('askAI executing Web Browser flow via proxy', 'info');
  try {
    const proxyController = new AbortController();
    const proxyTimer = setTimeout(() => proxyController.abort(), 30000); // Allow up to 30s for the proxy
    let proxyResponse;
    try {
      addSystemLog('askAI sending fetch request to /api/ai proxy...', 'info');
      proxyResponse = await fetch('/api/ai', {
        method: 'POST',
        signal: proxyController.signal,
        headers: {
          'Content-Type': 'application/json',
          'X-AI-Api-Key': aiApiKey.trim(),
          'X-AI-Base-Url': cleanBaseUrl,
        },
        body: JSON.stringify(payload),
      });
      clearTimeout(proxyTimer);
      addSystemLog(`askAI proxy responded: status=${proxyResponse.status}`, 'info');
    } catch (netErr: any) {
      clearTimeout(proxyTimer);
      addSystemLog(`askAI proxy connection failed (falling back to direct fetch): ${netErr.message || netErr}`, 'warn');
      throw netErr;
    }

    if (!proxyResponse.ok) {
      const errorText = await proxyResponse.text().catch(() => '');
      let errMsg = `AI Router Error (${proxyResponse.status})`;
      try {
        const parsed = JSON.parse(errorText);
        if (parsed.error?.message) {
          errMsg = parsed.error.message;
        } else if (parsed.error) {
          errMsg = parsed.error;
        } else if (parsed.message) {
          errMsg = parsed.message;
        }
      } catch {
        if (errorText) errMsg = errorText;
      }
      addSystemLog(`askAI proxy returned non-OK error: ${errMsg}`, 'error');
      throw new Error(errMsg);
    }

    const data = await proxyResponse.json();
    const text = (data.choices?.[0]?.message?.content || '').trim();
    addSystemLog(`askAI proxy success: response length=${text.length}`, 'info');
    return text;
  } catch (err: any) {
    // If the error came from the proxy response or timeout, propagate it directly
    if (err.message && (err.message.includes('AI Router Error') || err.name === 'AbortError')) {
      throw err;
    }
    
    // Otherwise, the proxy endpoint itself was unreachable (e.g., standalone dev server without /api/ai).
    // Fall back to direct fetch.
    const directEndpoint = `${cleanBaseUrl}/chat/completions`;
    addSystemLog(`askAI proxy unreachable, attempting direct fetch fallback to: ${directEndpoint}`, 'warn');
    const directController = new AbortController();
    const directTimer = setTimeout(() => directController.abort(), 30000);

    try {
      const directResponse = await fetch(directEndpoint, {
        method: 'POST',
        signal: directController.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${aiApiKey.trim()}`,
        },
        body: JSON.stringify(payload),
      });
      clearTimeout(directTimer);

      addSystemLog(`askAI direct fetch completed: status=${directResponse.status}`, 'info');

      if (!directResponse.ok) {
        const errorBody = await directResponse.text().catch(() => '');
        const errMsg = `AI Router Error (${directResponse.status}): ${directResponse.statusText || 'Unknown error'}. ${errorBody}`;
        addSystemLog(`askAI direct fetch non-OK error: ${errMsg}`, 'error');
        throw new Error(errMsg, { cause: err });
      }

      const directData = await directResponse.json();
      const text = (directData.choices?.[0]?.message?.content || '').trim();
      addSystemLog(`askAI direct fetch success: response length=${text.length}`, 'info');
      return text;
    } catch (directErr: any) {
      clearTimeout(directTimer);
      addSystemLog(`askAI direct fetch exception: ${directErr.message || directErr}`, 'error');
      if (directErr?.name === 'AbortError') {
        throw new Error('AI request timed out. Please check your API key and Base URL in Settings.', { cause: directErr });
      }
      throw directErr;
    }
  }
}

/**
 * Utility helper to clean and extract JSON from AI text responses in case markdown fences are returned.
 */
export function extractJSON(text: string): any {
  let cleaned = text.trim();
  // Remove markdown code fences if present (e.g. ```json ... ``` or ``` ...)
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\n/, '').replace(/\n```$/, '');
  }
  return JSON.parse(cleaned.trim());
}
