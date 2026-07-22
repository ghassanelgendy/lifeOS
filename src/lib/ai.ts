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

  // Use CapacitorHttp on native iOS/Android OR when running in ios vite mode.
  // Capacitor live-reload loads the dev server URL inside the native WebView –
  // isNativePlatform() returns false there but fetch() is subject to CORS/WKWebView
  // restrictions, so we must always use CapacitorHttp on the ios build.
  const useNativeHttp = Capacitor.isNativePlatform() || import.meta.env.MODE === 'ios';

  if (useNativeHttp) {
    const nativeEndpoint = `${cleanBaseUrl}/chat/completions`;
    const response = await CapacitorHttp.post({
      url: nativeEndpoint,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${aiApiKey.trim()}`,
      },
      data: payload,
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

  // Web Browser: try Vercel proxy first (8s timeout), then direct fetch (30s timeout)
  try {
    const proxyController = new AbortController();
    const proxyTimer = setTimeout(() => proxyController.abort(), 8000);
    const proxyResponse = await fetch('/api/ai', {
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

    if (proxyResponse.ok) {
      const data = await proxyResponse.json();
      return (data.choices?.[0]?.message?.content || '').trim();
    }
  } catch {
    // Proxy unavailable – fall through to direct fetch
  }

  // Direct fetch fallback with 30s timeout
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
  } catch (err: any) {
    clearTimeout(directTimer);
    if (err?.name === 'AbortError') {
      throw new Error('AI request timed out. Please check your API key and Base URL in Settings.');
    }
    throw err;
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
