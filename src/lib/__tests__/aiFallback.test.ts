import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AI_PROVIDERS,
  ALL_MODELS,
  getFallbackCandidates,
  recordModelSuccess,
  recordModelFailure,
  resetModelHealth,
  isModelInCooldown,
  getModelStat,
  getStoredBestModel,
  calculateModelScore,
  getProviderForModel,
} from '../aiFallback';
import { cleanAiResponse, extractJSON } from '../ai';

describe('AI Fallback & Smart Health Routing Engine', () => {
  beforeEach(() => {
    localStorage.clear();
    resetModelHealth();
  });

  it('should initialize with full catalog across Dahl and Bynara providers', () => {
    expect(ALL_MODELS.length).toBe(23);
    expect(AI_PROVIDERS.dahl.models.length).toBe(3);
    expect(AI_PROVIDERS.bynara.models.length).toBe(20);

    expect(getProviderForModel('MiniMaxAI/MiniMax-M2.7')).toBe('dahl');
    expect(getProviderForModel('moonshotai/Kimi-K2.6')).toBe('dahl');
    expect(getProviderForModel('deepseek-ai/DeepSeek-V4-Flash-0731')).toBe('dahl');
    expect(getProviderForModel('agnes-2.5-flash')).toBe('bynara');
    expect(getProviderForModel('mistral-large')).toBe('bynara');
    expect(getProviderForModel('gpt-5.4')).toBe('bynara');
  });

  it('should return prioritized candidate list with Auto mode', () => {
    const candidates = getFallbackCandidates({
      selectedModel: 'auto',
      dahlApiKey: 'dahl_test_key',
      bynaraApiKey: 'bynara_test_key',
      fallbackEnabled: true,
    });

    expect(candidates.length).toBe(23);
    expect(candidates[0].model).toBeDefined();
    expect(candidates[0].apiKey).toBeDefined();
    expect(candidates[0].baseUrl).toBeDefined();
  });

  it('should record success and update best model', () => {
    const model = 'MiniMaxAI/MiniMax-M2.7';
    recordModelSuccess(model, 'dahl', 1200);

    const stat = getModelStat(model);
    expect(stat.successCount).toBe(1);
    expect(stat.consecutiveFailures).toBe(0);
    expect(stat.avgLatencyMs).toBe(1200);
    expect(stat.lastStatusCode).toBe(200);
    expect(isModelInCooldown(model)).toBe(false);

    expect(getStoredBestModel()).toBe(model);
  });

  it('should record 429 rate limit failure and set cooldown to neglect model', () => {
    const model = 'minimax-m3';
    expect(isModelInCooldown(model)).toBe(false);

    recordModelFailure(model, 'bynara', 429, 'Rate limit exceeded');

    const stat = getModelStat(model);
    expect(stat.failureCount).toBe(1);
    expect(stat.consecutiveFailures).toBe(1);
    expect(stat.lastStatusCode).toBe(429);
    expect(isModelInCooldown(model)).toBe(true);

    const { score, inCooldown } = calculateModelScore(model);
    expect(inCooldown).toBe(true);
    expect(score).toBeLessThan(0); // Heavy negative cooldown penalty
  });

  it('should prioritize healthy models over neglected models in cooldown', () => {
    const dahlModel = 'MiniMaxAI/MiniMax-M2.7';
    const bynaraModel = 'minimax-m3';

    // Model 1 succeeds
    recordModelSuccess(dahlModel, 'dahl', 800);
    // Model 2 encounters 429 rate limit
    recordModelFailure(bynaraModel, 'bynara', 429, 'Too many requests');

    const candidates = getFallbackCandidates({
      selectedModel: 'auto',
      fallbackEnabled: true,
    });

    // The healthy model must appear before the cooldown model
    const dahlIndex = candidates.findIndex((c) => c.model === dahlModel);
    const bynaraIndex = candidates.findIndex((c) => c.model === bynaraModel);

    expect(dahlIndex).toBe(0);
    expect(bynaraIndex).toBeGreaterThan(dahlIndex);
    expect(candidates[bynaraIndex].inCooldown).toBe(true);
  });

  it('should reset health stats when requested', () => {
    recordModelFailure('gpt-5.4', 'bynara', 429, 'Rate limited');
    expect(isModelInCooldown('gpt-5.4')).toBe(true);

    resetModelHealth();
    expect(isModelInCooldown('gpt-5.4')).toBe(false);
    expect(getModelStat('gpt-5.4').failureCount).toBe(0);
  });

  it('should strip <think> reasoning tags in cleanAiResponse', () => {
    const raw = '<think>I am reasoning about the answer...</think>The final result is 42.';
    expect(cleanAiResponse(raw)).toBe('The final result is 42.');
  });

  it('should parse markdown JSON fences properly in extractJSON', () => {
    const raw = '```json\n{"tasks": ["task 1", "task 2"]}\n```';
    const parsed = extractJSON(raw);
    expect(parsed).toEqual({ tasks: ['task 1', 'task 2'] });
  });
});
