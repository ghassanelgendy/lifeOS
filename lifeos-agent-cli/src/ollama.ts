import type { ChatMessage } from "./types.js";

interface OllamaChatResponse {
  message?: {
    role?: string;
    content?: string;
  };
}

function buildApiUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  if (normalizedBase.endsWith("/api")) {
    return `${normalizedBase}${path}`;
  }

  return `${normalizedBase}/api${path}`;
}

function buildHeaders(apiKey?: string): HeadersInit {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  return headers;
}

export async function ollamaChat(
  baseUrl: string,
  model: string,
  apiKey: string | undefined,
  numPredict: number,
  messages: ChatMessage[],
): Promise<string> {
  const response = await fetch(buildApiUrl(baseUrl, "/chat"), {
    method: "POST",
    headers: buildHeaders(apiKey),
    body: JSON.stringify({
      model,
      stream: false,
      format: "json",
      options: {
        temperature: 0.2,
        num_predict: numPredict,
      },
      messages,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Ollama request failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as OllamaChatResponse;
  return data.message?.content?.trim() ?? "";
}

export async function checkOllamaHealth(baseUrl: string, apiKey?: string): Promise<boolean> {
  try {
    const response = await fetch(buildApiUrl(baseUrl, "/tags"), {
      method: "GET",
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
    });
    return response.ok;
  } catch {
    return false;
  }
}
