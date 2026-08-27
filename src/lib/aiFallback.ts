/**
 * AI Model Fallback & Smart Health Routing Engine
 * Supports multi-provider routing (Dahl Inference, Bynara Router, Custom),
 * automatic fallback cascade on errors (429 rate limit, 5xx, timeouts, 4xx),
 * health tracking with cooldown penalties to neglect failing models,
 * and automatic persistence of the best working model for future requests.
 */

export type AIProviderId = 'dahl' | 'bynara' | 'custom';

export interface AIModelDefinition {
  id: string;
  name: string;
  provider: AIProviderId;
  tier: 'flagship' | 'fast' | 'balanced' | 'free';
  priority: number; // lower number = higher priority
  description?: string;
}

export interface AIProviderConfig {
  id: AIProviderId;
  name: string;
  baseUrl: string;
  defaultApiKey: string;
  models: AIModelDefinition[];
}

export interface ModelHealthStat {
  modelId: string;
  providerId: AIProviderId;
  successCount: number;
  failureCount: number;
  consecutiveFailures: number;
  lastSuccessTime: number | null;
  lastFailureTime: number | null;
  lastStatusCode: number | null;
  lastErrorMessage: string | null;
  cooldownUntil: number | null; // Timestamp ms until when the model is in cooldown/neglected
  avgLatencyMs: number;
}

export interface AIModelHealthState {
  models: Record<string, ModelHealthStat>;
  bestModelId: string | null;
  lastUpdated: number;
}

// Built-in Providers & Full Model Catalog
export const AI_PROVIDERS: Record<AIProviderId, AIProviderConfig> = {
  dahl: {
    id: 'dahl',
    name: 'Dahl Inference API',
    baseUrl: 'https://inference.dahl.global/v1',
    defaultApiKey: '',
    models: [
      {
        id: 'MiniMaxAI/MiniMax-M2.7',
        name: 'MiniMax M2.7',
        provider: 'dahl',
        tier: 'flagship',
        priority: 1,
        description: 'Flagship reasoning & high performance',
      },
      {
        id: 'moonshotai/Kimi-K2.6',
        name: 'Kimi K2.6',
        provider: 'dahl',
        tier: 'flagship',
        priority: 2,
        description: 'Advanced reasoning & long context',
      },
      {
        id: 'deepseek-ai/DeepSeek-V4-Flash-0731',
        name: 'DeepSeek V4 Flash',
        provider: 'dahl',
        tier: 'fast',
        priority: 3,
        description: 'Ultra-fast streaming and structured output',
      },
    ],
  },
  bynara: {
    id: 'bynara',
    name: 'Bynara API Router',
    baseUrl: 'https://router.bynara.id/v1',
    defaultApiKey: '',
    models: [
      {
        id: 'agnes-2.5-flash',
        name: 'Agnes 2.5 Flash',
        provider: 'bynara',
        tier: 'fast',
        priority: 4,
        description: 'High-speed modern flash model',
      },
      {
        id: 'agnes-2.0-flash',
        name: 'Agnes 2.0 Flash',
        provider: 'bynara',
        tier: 'fast',
        priority: 5,
        description: 'Reliable fast flash completion',
      },
      {
        id: 'mistral-large',
        name: 'Mistral Large',
        provider: 'bynara',
        tier: 'flagship',
        priority: 6,
        description: 'Top-tier complex reasoning & multilingual',
      },
      {
        id: 'laguna-s-2.1',
        name: 'Laguna S-2.1',
        provider: 'bynara',
        tier: 'fast',
        priority: 7,
        description: 'Low-latency agentic responses',
      },
      {
        id: 'deepseek-v4-pro',
        name: 'DeepSeek V4 Pro',
        provider: 'bynara',
        tier: 'flagship',
        priority: 8,
        description: 'DeepSeek Flagship Pro reasoning',
      },
      {
        id: 'deepseek-v4-flash',
        name: 'DeepSeek V4 Flash',
        provider: 'bynara',
        tier: 'fast',
        priority: 9,
        description: 'Fast versatile DeepSeek model',
      },
      {
        id: 'minimax-m3',
        name: 'MiniMax M3',
        provider: 'bynara',
        tier: 'flagship',
        priority: 10,
        description: 'MiniMax M3 architecture',
      },
      {
        id: 'gpt-5.4',
        name: 'GPT-5.4',
        provider: 'bynara',
        tier: 'flagship',
        priority: 11,
        description: 'Advanced frontier model',
      },
      {
        id: 'gpt-5.5',
        name: 'GPT-5.5',
        provider: 'bynara',
        tier: 'flagship',
        priority: 12,
        description: 'Next-gen frontier reasoning',
      },
      {
        id: 'mistral-medium-3-5',
        name: 'Mistral Medium 3.5',
        provider: 'bynara',
        tier: 'balanced',
        priority: 13,
        description: 'Balanced performance and speed',
      },
      {
        id: 'mimo-v2.5-pro-ultraspeed',
        name: 'Mimo v2.5 Pro Ultraspeed',
        provider: 'bynara',
        tier: 'fast',
        priority: 14,
        description: 'High throughput ultra-speed',
      },
      {
        id: 'mimo-v2.5-pro',
        name: 'Mimo v2.5 Pro',
        provider: 'bynara',
        tier: 'balanced',
        priority: 15,
        description: 'Balanced pro reasoning',
      },
      {
        id: 'mimo-v2.5',
        name: 'Mimo v2.5',
        provider: 'bynara',
        tier: 'balanced',
        priority: 16,
        description: 'Standard efficient completion',
      },
      {
        id: 'stepfun-3.7-flash',
        name: 'Stepfun 3.7 Flash',
        provider: 'bynara',
        tier: 'fast',
        priority: 17,
        description: 'Stepfun fast lightweight model',
      },
      {
        id: 'muse-spark-1.2',
        name: 'Muse Spark 1.2',
        provider: 'bynara',
        tier: 'balanced',
        priority: 18,
        description: 'Creative and structured generation',
      },
      {
        id: 'muse-spark-1.2-contributor',
        name: 'Muse Spark 1.2 Contributor',
        provider: 'bynara',
        tier: 'balanced',
        priority: 19,
        description: 'Community contributor tier',
      },
      {
        id: 'qwen-3.8-max-free',
        name: 'Qwen 3.8 Max (Free)',
        provider: 'bynara',
        tier: 'free',
        priority: 20,
        description: 'Free tier Qwen model',
      },
      {
        id: 'tencent-hy3-free',
        name: 'Tencent HY3 (Free)',
        provider: 'bynara',
        tier: 'free',
        priority: 21,
        description: 'Free tier Tencent Hunyuan',
      },
      {
        id: 'deepseek-v4-pro-free',
        name: 'DeepSeek V4 Pro (Free)',
        provider: 'bynara',
        tier: 'free',
        priority: 22,
        description: 'Free tier DeepSeek Pro',
      },
      {
        id: 'ling-3.0-flash-free',
        name: 'Ling 3.0 Flash (Free)',
        provider: 'bynara',
        tier: 'free',
        priority: 23,
        description: 'Free tier Ling Flash',
      },
    ],
  },
  custom: {
    id: 'custom',
    name: 'Custom Provider',
    baseUrl: '',
    defaultApiKey: '',
    models: [],
  },
};

export const ALL_MODELS: AIModelDefinition[] = [
  ...AI_PROVIDERS.dahl.models,
  ...AI_PROVIDERS.bynara.models,
];

const HEALTH_STORAGE_KEY = 'lifeos_ai_model_health_v1';
const BEST_MODEL_STORAGE_KEY = 'lifeos_ai_best_model_id';

// In-memory cache synced with localStorage
let healthCache: AIModelHealthState | null = null;

export function getModelDefinition(modelId: string): AIModelDefinition | undefined {
  return ALL_MODELS.find((m) => m.id === modelId);
}

export function getProviderForModel(modelId: string): AIProviderId {
  const model = getModelDefinition(modelId);
  if (model) return model.provider;
  if (modelId.startsWith('MiniMaxAI/') || modelId.startsWith('moonshotai/') || modelId.startsWith('deepseek-ai/')) {
    return 'dahl';
  }
  return 'bynara';
}

/**
 * Load health stats from localStorage or initialize defaults
 */
export function loadModelHealthState(): AIModelHealthState {
  if (healthCache) return healthCache;

  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(HEALTH_STORAGE_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.models) {
        healthCache = parsed;
        return healthCache!;
      }
    }
  } catch {
    // Ignore parse error and initialize new
  }

  const initialBestModel = typeof window !== 'undefined' ? localStorage.getItem(BEST_MODEL_STORAGE_KEY) : null;

  healthCache = {
    models: {},
    bestModelId: initialBestModel || 'MiniMaxAI/MiniMax-M2.7',
    lastUpdated: Date.now(),
  };

  return healthCache;
}

/**
 * Persist health state to localStorage
 */
function saveModelHealthState(state: AIModelHealthState) {
  healthCache = state;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(HEALTH_STORAGE_KEY, JSON.stringify(state));
      if (state.bestModelId) {
        localStorage.setItem(BEST_MODEL_STORAGE_KEY, state.bestModelId);
      }
    } catch {
      // Storage quota or error
    }
  }
}

/**
 * Get health stat for a specific model
 */
export function getModelStat(modelId: string): ModelHealthStat {
  const state = loadModelHealthState();
  if (!state.models[modelId]) {
    const provider = getProviderForModel(modelId);
    state.models[modelId] = {
      modelId,
      providerId: provider,
      successCount: 0,
      failureCount: 0,
      consecutiveFailures: 0,
      lastSuccessTime: null,
      lastFailureTime: null,
      lastStatusCode: null,
      lastErrorMessage: null,
      cooldownUntil: null,
      avgLatencyMs: 0,
    };
  }
  return state.models[modelId];
}

/**
 * Check if a model is currently neglected due to an active cooldown
 */
export function isModelInCooldown(modelId: string): boolean {
  const stat = getModelStat(modelId);
  if (!stat.cooldownUntil) return false;
  return Date.now() < stat.cooldownUntil;
}

/**
 * Record a successful completion for a model and update it as the best model
 */
export function recordModelSuccess(modelId: string, providerId: AIProviderId, latencyMs: number) {
  const state = loadModelHealthState();
  const stat = getModelStat(modelId);

  stat.providerId = providerId;
  stat.successCount += 1;
  stat.consecutiveFailures = 0;
  stat.cooldownUntil = null;
  stat.lastSuccessTime = Date.now();
  stat.lastStatusCode = 200;
  stat.lastErrorMessage = null;

  // Moving average latency
  if (stat.avgLatencyMs === 0) {
    stat.avgLatencyMs = latencyMs;
  } else {
    stat.avgLatencyMs = Math.round(stat.avgLatencyMs * 0.7 + latencyMs * 0.3);
  }

  state.models[modelId] = stat;
  state.bestModelId = modelId;
  state.lastUpdated = Date.now();

  saveModelHealthState(state);
}

/**
 * Record a failure for a model and set an intelligent cooldown penalty based on HTTP error code
 */
export function recordModelFailure(
  modelId: string,
  providerId: AIProviderId,
  statusCode: number | null,
  errorMessage: string
) {
  const state = loadModelHealthState();
  const stat = getModelStat(modelId);

  stat.providerId = providerId;
  stat.failureCount += 1;
  stat.consecutiveFailures += 1;
  stat.lastFailureTime = Date.now();
  stat.lastStatusCode = statusCode;
  stat.lastErrorMessage = (errorMessage || 'Unknown error').slice(0, 300);

  const now = Date.now();
  let cooldownDurationMs = 120_000; // Default 2 minutes for general network/unknown errors

  if (statusCode === 429) {
    // Rate limit: 5 minutes cooldown base, increases with consecutive failures
    cooldownDurationMs = Math.min(300_000 * Math.max(1, stat.consecutiveFailures), 1_800_000); // 5 to 30 mins
  } else if (statusCode === 402) {
    // Insufficient credits / payment required: 30 minutes
    cooldownDurationMs = 1_800_000;
  } else if (statusCode === 404 || statusCode === 400) {
    // Model not found or unsupported endpoint: 20 minutes
    cooldownDurationMs = 1_200_000;
  } else if (statusCode && statusCode >= 500) {
    // Server-side provider error (502, 503, 504): 3 minutes
    cooldownDurationMs = 180_000;
  }

  stat.cooldownUntil = now + cooldownDurationMs;
  state.models[modelId] = stat;
  state.lastUpdated = now;

  // If the failing model was the stored best model, clear it so the next healthiest model takes over
  if (state.bestModelId === modelId) {
    state.bestModelId = null;
  }

  saveModelHealthState(state);
}

/**
 * Reset health stats for all models or a specific model
 */
export function resetModelHealth(targetModelId?: string) {
  const state = loadModelHealthState();
  if (targetModelId) {
    delete state.models[targetModelId];
  } else {
    state.models = {};
    state.bestModelId = 'MiniMaxAI/MiniMax-M2.7';
  }
  state.lastUpdated = Date.now();
  saveModelHealthState(state);
}

/**
 * Calculate dynamic health and ranking score for a candidate model.
 * Higher score = higher priority in the fallback queue.
 */
export function calculateModelScore(
  modelId: string,
  preferredModelId?: string | null
): { score: number; inCooldown: boolean; reason: string } {
  const stat = getModelStat(modelId);
  const def = getModelDefinition(modelId);
  const now = Date.now();
  const inCooldown = Boolean(stat.cooldownUntil && now < stat.cooldownUntil);

  let score = 0;

  // 1. Base Priority from catalog (1 to 25 -> 100 to 75)
  const basePriority = def ? 100 - def.priority : 50;
  score += basePriority;

  // 2. Cooldown penalty: heavy negative score to neglect failing models
  if (inCooldown) {
    score -= 10_000;
  }

  // 3. User preferred model or stored best working model bonus
  const state = loadModelHealthState();
  if (preferredModelId && preferredModelId !== 'auto' && modelId === preferredModelId) {
    score += 500;
  } else if (state.bestModelId === modelId) {
    score += 300;
  }

  // 4. Success history bonus
  score += Math.min(stat.successCount * 20, 200);

  // 5. Consecutive failure penalty
  score -= stat.consecutiveFailures * 100;

  // 6. Recency bonus if succeeded within last 2 hours
  if (stat.lastSuccessTime && now - stat.lastSuccessTime < 7_200_000) {
    score += 100;
  }

  // 7. Latency bonus (faster models prioritized if healthy)
  if (stat.avgLatencyMs > 0 && !inCooldown) {
    const latencyBonus = Math.max(0, 50 - Math.round(stat.avgLatencyMs / 100));
    score += latencyBonus;
  }

  return {
    score,
    inCooldown,
    reason: inCooldown
      ? `In cooldown until ${new Date(stat.cooldownUntil!).toLocaleTimeString()}`
      : `Score ${score} (Successes: ${stat.successCount}, Failures: ${stat.failureCount})`,
  };
}

export interface FallbackCandidate {
  model: string;
  provider: AIProviderId;
  baseUrl: string;
  apiKey: string;
  score: number;
  inCooldown: boolean;
  tier: string;
  name: string;
}

/**
 * Returns prioritized list of candidate models for fallback execution.
 * Resolves API keys and Base URLs from user settings or provider defaults.
 */
export function getFallbackCandidates(options: {
  selectedModel?: string;
  customBaseUrl?: string;
  customApiKey?: string;
  dahlApiKey?: string;
  bynaraApiKey?: string;
  fallbackEnabled?: boolean;
}): FallbackCandidate[] {
  const {
    selectedModel = 'auto',
    customBaseUrl = '',
    customApiKey = '',
    dahlApiKey = '',
    bynaraApiKey = '',
    fallbackEnabled = true,
  } = options;

  const envDahlKey = (import.meta.env.VITE_AI_DAHL_API_KEY || import.meta.env.VITE_DAHL_KEY || '').trim();
  const envBynaraKey = (import.meta.env.VITE_AI_BYNARA_API_KEY || import.meta.env.VITE_BYNARA_KEY || '').trim();
  const envGenKey = (import.meta.env.VITE_AI_API_KEY || '').trim();

  const resolvedDahlKey = (dahlApiKey || '').trim() || envDahlKey || customApiKey.trim() || envGenKey || AI_PROVIDERS.dahl.defaultApiKey;
  const resolvedBynaraKey = (bynaraApiKey || '').trim() || envBynaraKey || customApiKey.trim() || envGenKey || AI_PROVIDERS.bynara.defaultApiKey;

  // If user provided a custom model or custom URL and fallback is disabled
  if (selectedModel && selectedModel !== 'auto' && !fallbackEnabled) {
    const def = getModelDefinition(selectedModel);
    const provider = def ? def.provider : (customBaseUrl ? 'custom' : getProviderForModel(selectedModel));
    const baseUrl = provider === 'custom'
      ? customBaseUrl
      : provider === 'dahl'
      ? AI_PROVIDERS.dahl.baseUrl
      : AI_PROVIDERS.bynara.baseUrl;
    const apiKey = provider === 'custom'
      ? customApiKey
      : provider === 'dahl'
      ? resolvedDahlKey
      : resolvedBynaraKey;

    return [
      {
        model: selectedModel,
        provider,
        baseUrl,
        apiKey,
        score: 1000,
        inCooldown: isModelInCooldown(selectedModel),
        tier: def?.tier || 'custom',
        name: def?.name || selectedModel,
      },
    ];
  }

  // Build full candidate list
  const candidates: FallbackCandidate[] = ALL_MODELS.map((m) => {
    const provider = m.provider;
    const baseUrl = provider === 'dahl' ? AI_PROVIDERS.dahl.baseUrl : AI_PROVIDERS.bynara.baseUrl;
    const apiKey = provider === 'dahl' ? resolvedDahlKey : resolvedBynaraKey;
    const { score, inCooldown } = calculateModelScore(m.id, selectedModel);

    return {
      model: m.id,
      provider,
      baseUrl,
      apiKey,
      score,
      inCooldown,
      tier: m.tier,
      name: m.name,
    };
  });

  // Sort candidates by score descending
  candidates.sort((a, b) => b.score - a.score);

  // If a custom model is configured and not in ALL_MODELS, prepend it if selected
  if (selectedModel && selectedModel !== 'auto' && !ALL_MODELS.some((m) => m.id === selectedModel)) {
    const provider = customBaseUrl ? 'custom' : getProviderForModel(selectedModel);
    const baseUrl = customBaseUrl || (provider === 'dahl' ? AI_PROVIDERS.dahl.baseUrl : AI_PROVIDERS.bynara.baseUrl);
    const apiKey = customApiKey || (provider === 'dahl' ? resolvedDahlKey : resolvedBynaraKey);
    const inCooldown = isModelInCooldown(selectedModel);
    candidates.unshift({
      model: selectedModel,
      provider,
      baseUrl,
      apiKey,
      score: inCooldown ? -5000 : 2000,
      inCooldown,
      tier: 'custom',
      name: selectedModel,
    });
  }

  // If user selected a specific model (and fallback is enabled), ensure it is the very first candidate
  // UNLESS it is currently in cooldown and healthy alternatives exist
  if (selectedModel && selectedModel !== 'auto') {
    const index = candidates.findIndex((c) => c.model === selectedModel);
    if (index > 0) {
      const selected = candidates[index];
      if (!selected.inCooldown) {
        candidates.splice(index, 1);
        candidates.unshift(selected);
      }
    }
  }

  return candidates;
}

/**
 * Get current stored best working model or fallback default
 */
export function getStoredBestModel(): string {
  const state = loadModelHealthState();
  return state.bestModelId || 'MiniMaxAI/MiniMax-M2.7';
}
