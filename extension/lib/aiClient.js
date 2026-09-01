/**
 * lifeOS AI Client
 * Lightweight LLM integration for Note Summarizer, Webpage Analyzer, and Custom Prompts.
 */

import { ENV_CONFIG } from './envConfig.js';

export class AIClient {
  constructor() {
    this.provider = 'bynara';
    this.apiKey = ENV_CONFIG.aiApiKey || '';
    this.baseUrl = ENV_CONFIG.aiBaseUrl || 'https://inference.dahl.global/v1';
    this.model = ENV_CONFIG.aiModel || 'gpt-4o-mini';
    this.lifeOsUrl = ENV_CONFIG.lifeOsUrl || 'http://localhost:5173';
  }

  async loadConfig() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(
        ['aiProvider', 'aiApiKey', 'aiBaseUrl', 'aiModel', 'lifeOsUrl'],
        (items) => {
          this.provider = items.aiProvider || 'bynara';
          this.apiKey = items.aiApiKey || ENV_CONFIG.aiApiKey || '';
          this.baseUrl = items.aiBaseUrl || ENV_CONFIG.aiBaseUrl || 'https://inference.dahl.global/v1';
          this.model = items.aiModel || ENV_CONFIG.aiModel || 'gpt-4o-mini';
          this.lifeOsUrl = items.lifeOsUrl || ENV_CONFIG.lifeOsUrl || 'http://localhost:5173';
          resolve(items);
        }
      );
    });
  }

  async saveConfig(config) {
    return new Promise((resolve) => {
      chrome.storage.sync.set(config, () => {
        if (config.aiProvider !== undefined) this.provider = config.aiProvider;
        if (config.aiApiKey !== undefined) this.apiKey = config.aiApiKey;
        if (config.aiBaseUrl !== undefined) this.baseUrl = config.aiBaseUrl;
        if (config.aiModel !== undefined) this.model = config.aiModel;
        if (config.lifeOsUrl !== undefined) this.lifeOsUrl = config.lifeOsUrl;
        resolve(true);
      });
    });
  }

  cleanResponse(text) {
    if (!text) return '';
    return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  }

  async askAI({ systemPrompt, userPrompt, temperature = 0.5 }) {
    await this.loadConfig();

    const messages = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: userPrompt });

    const payload = {
      model: this.model,
      messages,
      temperature,
    };

    // 1. Try Direct API endpoint if Key is provided
    if (this.apiKey) {
      const cleanBase = this.baseUrl.replace(/\/+$/, '');
      const endpoint = `${cleanBase}/chat/completions`;

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey.trim()}`,
      };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`AI Request Failed (${res.status}): ${errorText}`);
      }

      const data = await res.json();
      const rawText = data?.choices?.[0]?.message?.content || '';
      return this.cleanResponse(rawText);
    }

    // 2. Fallback: Try lifeOS /api/ai proxy
    if (this.lifeOsUrl) {
      const proxyUrl = `${this.lifeOsUrl.replace(/\/+$/, '')}/api/ai`;
      const res = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`lifeOS AI Proxy Error (${res.status}): ${errorText}. Please configure an AI API Key in Extension Settings.`);
      }

      const data = await res.json();
      const rawText = data?.choices?.[0]?.message?.content || '';
      return this.cleanResponse(rawText);
    }

    throw new Error('No AI configuration found. Please set your AI API Key or lifeOS URL in Settings.');
  }

  /**
   * Analyze Webpage / Note with optional custom prompt
   */
  async analyzeContent({ title = '', url = '', content = '', customPrompt = '', mode = 'summarize' }) {
    const systemPrompt = `You are an expert AI knowledge organizer for lifeOS personal workspace.
Your task is to analyze web clips, articles, and notes and format them into structured, high-value markdown notes.
Ensure clean headers (###), bullet points, and concise key takeaways. Avoid meta-commentary like "Here is your summary".`;

    let userPrompt = '';
    const headerInfo = title || url ? `### Source: [${title || 'Untitled Webpage'}](${url || '#'})\n\n` : '';

    if (customPrompt && customPrompt.trim()) {
      userPrompt = `${headerInfo}### Raw Content:
${content}

### User Instructions / Specific Goal:
${customPrompt.trim()}

Please fulfill the user's instructions based on the raw content above in clean markdown.`;
    } else {
      userPrompt = `${headerInfo}### Raw Content:
${content}

Please provide a structured, high-density markdown summary for this note:
- **TL;DR Overview** (1-2 sentences capturing core value)
- **Key Takeaways & Core Ideas** (bullet points)
- **Tools / Architecture / Technologies** (if mentioned)
- **Actionable Next Steps / Ideas to Try**`;
    }

    return this.askAI({ systemPrompt, userPrompt });
  }
}

export const aiClient = new AIClient();
