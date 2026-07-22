import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { useUIStore } from '../stores/useUIStore';

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

  if (!aiEnabled) {
    throw new Error('AI Integration is currently disabled. Enable it in Settings.');
  }
  if (!aiApiKey) {
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
  if (Capacitor.isNativePlatform()) {
    const nativeEndpoint = `${cleanBaseUrl}/chat/completions`;
    const response = await CapacitorHttp.post({
      url: nativeEndpoint,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${aiApiKey.trim()}`,
      },
      data: JSON.stringify(payload), // must be string for WKWebView bridge
    });

    if (response.status !== 200) {
      const errorMsg = response.data?.error?.message || response.data || 'Unknown native error';
      throw new Error(`AI Router Error (${response.status}): ${errorMsg}`);
    }

    let resData = response.data;
    if (typeof resData === 'string') {
      try {
        resData = JSON.parse(resData);
      } catch (e) {
        // Fallback to raw text if not JSON
      }
    }

    const text = resData?.choices?.[0]?.message?.content || (typeof resData === 'string' ? resData : '');
    return text.trim();
  }

  // Web Browser environment: execute via /api/ai proxy to avoid CORS
  try {
    const proxyController = new AbortController();
    const proxyTimer = setTimeout(() => proxyController.abort(), 30000); // Allow up to 30s for the proxy
    let proxyResponse;
    try {
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
    } catch (netErr) {
      clearTimeout(proxyTimer);
      // Network/CORS failure calling the proxy itself (e.g. proxy endpoint doesn't exist on standalone server).
      // Fall through to direct fetch.
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
      throw new Error(errMsg);
    }

    const data = await proxyResponse.json();
    return (data.choices?.[0]?.message?.content || '').trim();
  } catch (err: any) {
    // If the error came from the proxy response or timeout, propagate it directly
    if (err.message && (err.message.includes('AI Router Error') || err.name === 'AbortError')) {
      throw err;
    }
    
    // Otherwise, the proxy endpoint itself was unreachable (e.g., standalone dev server without /api/ai).
    // Fall back to direct fetch.
    const directController = new AbortController();
    const directTimer = setTimeout(() => directController.abort(), 30000);

    try {
      const directResponse = await fetch(`${cleanBaseUrl}/chat/completions`, {
        method: 'POST',
        signal: directController.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${aiApiKey.trim()}`,
        },
        body: JSON.stringify(payload),
      });
      clearTimeout(directTimer);

      if (!directResponse.ok) {
        const errorBody = await directResponse.text().catch(() => '');
        throw new Error(`AI Router Error (${directResponse.status}): ${directResponse.statusText || 'Unknown error'}. ${errorBody}`);
      }

      const directData = await directResponse.json();
      return (directData.choices?.[0]?.message?.content || '').trim();
    } catch (directErr: any) {
      clearTimeout(directTimer);
      if (directErr?.name === 'AbortError') {
        throw new Error('AI request timed out. Please check your API key and Base URL in Settings.');
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
