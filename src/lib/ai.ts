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
  const endpoint = `${cleanBaseUrl}/chat/completions`;

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

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${aiApiKey.trim()}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`AI Router Error (${response.status}): ${response.statusText || 'Unknown error'}. ${errorBody}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';
  return text.trim();
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
