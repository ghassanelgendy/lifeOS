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

  resolveModel(rawModel, baseUrl) {
    let m = (rawModel || '').trim();
    const cleanBase = (baseUrl || '').toLowerCase();
    const isDahl = cleanBase.includes('dahl.global');

    if (!m || m.toLowerCase() === 'auto' || m === 'gpt-4o-mini') {
      return isDahl ? 'MiniMaxAI/MiniMax-M2.7' : 'deepseek-v4-flash';
    }
    return m;
  }

  getCandidateModels(requestedModel, baseUrl) {
    const cleanBase = (baseUrl || '').toLowerCase();
    const isDahl = cleanBase.includes('dahl.global');
    const primary = this.resolveModel(requestedModel, baseUrl);

    if (isDahl) {
      const dahlModels = [
        'MiniMaxAI/MiniMax-M2.7',
        'moonshotai/Kimi-K2.6',
        'deepseek-ai/DeepSeek-V4-Flash-0731',
      ];
      return [primary, ...dahlModels.filter((x) => x !== primary)];
    }

    const bynaraModels = [
      'deepseek-v4-flash',
      'deepseek-v4-pro',
      'agnes-2.5-flash',
      'mistral-large',
    ];
    return [primary, ...bynaraModels.filter((x) => x !== primary)];
  }

  async askAI({ systemPrompt, userPrompt, temperature = 0.5 }) {
    await this.loadConfig();

    const messages = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: userPrompt });

    // 1. Try Direct API endpoint if Key is provided (with model auto-fallback)
    if (this.apiKey) {
      const cleanBase = this.baseUrl.replace(/\/+$/, '');
      const endpoint = `${cleanBase}/chat/completions`;
      const candidates = this.getCandidateModels(this.model, cleanBase);

      let lastError = null;
      for (const candidateModel of candidates) {
        try {
          const payload = {
            model: candidateModel,
            messages,
            temperature,
          };

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
          if (rawText) {
            return this.cleanResponse(rawText);
          }
        } catch (err) {
          lastError = err;
          console.warn(`[lifeOS Extension AI] Candidate ${candidateModel} failed:`, err);
        }
      }

      if (lastError) throw lastError;
    }

    // 2. Fallback: Try lifeOS /api/ai proxy
    if (this.lifeOsUrl) {
      const proxyUrl = `${this.lifeOsUrl.replace(/\/+$/, '')}/api/ai`;
      const payload = {
        model: this.resolveModel(this.model, this.baseUrl),
        messages,
        temperature,
      };

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
    const systemPrompt = `You are lifeOS Executive Web & Knowledge Summarizer.
Your goal is to extract the core essence, valuable insights, key findings, and actionable takeaways from web pages, articles, documentation, or releases.
Guidelines:
- Adapt your summary format naturally based on what the content is (e.g. software release, technical article, tutorial, product review, general note).
- DO NOT use generic boilerplate like "Tools / Architecture" if it is not applicable.
- Keep it concise, high-signal, clean, and directly useful.
- Always output clean Markdown with standard bullet points and subheadings.
- Avoid meta-commentary like "Here is your summary".`;

    let userPrompt = '';
    const headerInfo = title || url ? `Source: [${title || 'Untitled Webpage'}](${url || '#'})\n\n` : '';

    if (customPrompt && customPrompt.trim()) {
      userPrompt = `${headerInfo}Content:
${content}

User Instructions:
${customPrompt.trim()}`;
    } else {
      userPrompt = `${headerInfo}Content to summarize:
${content}

Please provide a concise, high-value summary of the above content. Highlight key insights, what's new or important, and practical takeaways.`;
    }

    return this.askAI({ systemPrompt, userPrompt });
  }
}

export const aiClient = new AIClient();
