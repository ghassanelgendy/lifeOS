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

  // Bypassing CORS constraints across all web and mobile platforms
  if (Capacitor.isNativePlatform()) {
    // Under native iOS / Android, execute via native CapHttp wrapper to completely bypass CORS preflights
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
      throw new Error(`AI Router Native Error (${response.status}): ${errorMsg}`);
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

  // Web Browser environment: Proxy request through Vercel endpoint or fallback to direct fetch
  try {
    const proxyEndpoint = '/api/ai';
    const response = await fetch(proxyEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AI-Api-Key': aiApiKey.trim(),
        'X-AI-Base-Url': cleanBaseUrl,
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const data = await response.json();
      const text = data.choices?.[0]?.message?.content || '';
      return text.trim();
    }
  } catch (err) {
    // Proxy failed or unavailable (e.g. standalone mobile web/dev server), fallback to direct API endpoint
  }

  // Fallback direct request
  const directEndpoint = `${cleanBaseUrl}/chat/completions`;
  const directResponse = await fetch(directEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${aiApiKey.trim()}`,
    },
    body: JSON.stringify(payload),
  });

  if (!directResponse.ok) {
    const errorBody = await directResponse.text().catch(() => '');
    throw new Error(`AI Router Error (${directResponse.status}): ${directResponse.statusText || 'Unknown error'}. ${errorBody}`);
  }

  const directData = await directResponse.json();
  const directText = directData.choices?.[0]?.message?.content || '';
  return directText.trim();
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
