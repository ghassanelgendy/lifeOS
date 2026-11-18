import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Task } from '../types/schema';

const askAI = vi.fn();
vi.mock('./ai', () => ({ askAI: (...a: unknown[]) => askAI(...a), extractJSON: (s: string) => JSON.parse(s) }));

import { analyzeTaskSimilarityWithAI } from './taskSimilarityAnalyzer';

const task = (id: string, title: string): Task => ({ id, title, is_completed: false } as unknown as Task);

describe('analyzeTaskSimilarityWithAI', () => {
  beforeEach(() => {
    askAI.mockReset();
  });

  it('skips the model when nothing resembles the new task', async () => {
    const r = await analyzeTaskSimilarityWithAI('Buy groceries', undefined, [task('1', 'Renew passport')]);
    expect(r.hasDuplicate).toBe(false);
    expect(askAI).not.toHaveBeenCalled();
  });

  it('flags a near-identical title without calling the model', async () => {
    const r = await analyzeTaskSimilarityWithAI('Renew passport', undefined, [task('1', 'renew passport')]);
    expect(r.hasDuplicate).toBe(true);
    expect(askAI).not.toHaveBeenCalled();
  });

  it('stops waiting for a slow model and answers from local matches', async () => {
    askAI.mockReturnValue(new Promise(() => {}));
    const r = await analyzeTaskSimilarityWithAI('Pay electricity bill now', undefined, [task('1', 'Electricity bill reminder')]);
    expect(askAI).toHaveBeenCalledTimes(1);
    expect(r.hasDuplicate).toBe(false);
  }, 8000);
});
