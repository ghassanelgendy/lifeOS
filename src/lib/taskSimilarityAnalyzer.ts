import { askAI, extractJSON } from './ai';
import type { Task, TaskList, Tag } from '../types/schema';

export interface TaskSimilarityMatch {
  existingTask: Task;
  similarityScore: number; // 0 - 100
  reason: string;
  suggestedAction: 'merge_into_existing' | 'keep_both' | 'replace_existing' | 'add_as_subtask';
  mergedTitle?: string;
  mergedDescription?: string;
}

export interface TaskSimilarityAnalysisResult {
  hasDuplicate: boolean;
  highestScore: number;
  matches: TaskSimilarityMatch[];
}

/**
 * Normalizes text by removing common Arabic and English stop words, diacritics, and punctuation.
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F]/g, '') // remove Arabic tashkeel
    .replace(/[^\w\s\u0600-\u06FF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Fast client-side lexical similarity check (Jaccard + Substring overlap)
 * Used as a fast pre-filter to find candidate tasks before invoking the LLM.
 */
export function quickLexicalSimilarity(query: string, target: string): number {
  const normQ = normalizeText(query);
  const normT = normalizeText(target);

  if (!normQ || !normT) return 0;
  if (normQ === normT) return 100;
  if (normT.includes(normQ) || normQ.includes(normT)) return 85;

  const wordsQ = new Set(normQ.split(' ').filter((w) => w.length > 1));
  const wordsT = new Set(normT.split(' ').filter((w) => w.length > 1));

  if (!wordsQ.size || !wordsT.size) return 0;

  const intersection = new Set([...wordsQ].filter((x) => wordsT.has(x)));
  const union = new Set([...wordsQ, ...wordsT]);

  const jaccard = (intersection.size / union.size) * 100;
  return Math.round(jaccard);
}

/**
 * Finds candidate existing tasks that might be duplicates or semantically related.
 */
export function findLexicalCandidates(
  newTitle: string,
  existingTasks: Task[],
  limit = 8
): { task: Task; score: number }[] {
  const activeTasks = existingTasks.filter((t) => !t.is_completed);

  const scored = activeTasks
    .map((task) => {
      const titleScore = quickLexicalSimilarity(newTitle, task.title);
      const descScore = task.description ? quickLexicalSimilarity(newTitle, task.description) * 0.7 : 0;
      return {
        task,
        score: Math.max(titleScore, descScore),
      };
    })
    .filter((item) => item.score >= 25)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored;
}

/**
 * Active AI Analyzer: performs deep semantic analysis on new task vs existing active tasks.
 * Detects semantic duplicates, redundant items, overlapping goals, and recommends merging.
 */
export async function analyzeTaskSimilarityWithAI(
  newTitle: string,
  newDescription: string | undefined,
  existingTasks: Task[],
  taskLists: TaskList[] = [],
  tags: Tag[] = []
): Promise<TaskSimilarityAnalysisResult> {
  const trimmed = newTitle.trim();
  if (!trimmed || trimmed.length < 3) {
    return { hasDuplicate: false, highestScore: 0, matches: [] };
  }

  // 1. Pre-filter top candidate tasks using fast multilingual lexical scoring
  const candidates = findLexicalCandidates(trimmed, existingTasks, 10);

  // If no candidates even remotely match lexically, take the most recent 15 active tasks for semantic inspection
  let targetPool = candidates.map((c) => c.task);
  if (targetPool.length === 0) {
    targetPool = existingTasks.filter((t) => !t.is_completed).slice(0, 15);
  }

  if (targetPool.length === 0) {
    return { hasDuplicate: false, highestScore: 0, matches: [] };
  }

  const listMap = new Map(taskLists.map((l) => [l.id, l.name]));
  const tagMap = new Map(tags.map((t) => [t.id, t.name]));

  const candidateSummaries = targetPool.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description || null,
    due_date: t.due_date || null,
    list: t.list_id ? listMap.get(t.list_id) || 'Inbox' : 'Inbox',
    tags: (t.tag_ids || []).map((tid) => tagMap.get(tid)).filter(Boolean),
  }));

  const systemPrompt = `You are lifeOS AI Task Deduplication & Merge Engine.
You understand English, Egyptian Arabic dialect (اللهجة المصرية), Franco-Arabic, and technical programming jargon.
Your objective is to inspect a newly drafted task against existing active tasks, detect if it is already tracked (exact or semantic duplicate), and provide high-value merging recommendations.

### Instructions:
1. Compare the new task with existing candidate tasks.
2. Calculate a "similarity_score" (0 to 100):
   - 90-100: Exact or near-exact duplicate (same intent, same person/bug/feature).
   - 70-89: Strongly related (overlapping action item, sub-part, or continuation).
   - 50-69: Moderately related (same project/domain, but distinct action).
   - <50: Distinct/unrelated.
3. Recommend "suggested_action":
   - "merge_into_existing": Combine into the existing task, updating description or title.
   - "replace_existing": New task is a clearer/updated version of the old task.
   - "add_as_subtask": New task is a specific sub-step of the existing task.
   - "keep_both": Different actions; keep both active.
4. If similarity >= 70, formulate a clean "merged_title", "merged_description", and a concise "reason" (in English or Arabic matching the input).

### Return ONLY valid JSON format:
{
  "matches": [
    {
      "task_id": "existing-task-uuid",
      "similarity_score": 95,
      "reason": "You already have a task to fix this specific issue.",
      "suggested_action": "merge_into_existing",
      "merged_title": "Clean unified task title",
      "merged_description": "Combined notes and steps..."
    }
  ]
}`;

  const userPrompt = `### New Task Being Added:
- Title: "${newTitle}"
${newDescription ? `- Description: "${newDescription}"` : ''}

### Existing Active Tasks:
${JSON.stringify(candidateSummaries, null, 2)}`;

  try {
    const rawResponse = await askAI(systemPrompt, userPrompt, true);
    const parsed = extractJSON(rawResponse);

    const matches: TaskSimilarityMatch[] = [];
    let highestScore = 0;

    if (Array.isArray(parsed?.matches)) {
      for (const m of parsed.matches) {
        const score = Number(m.similarity_score) || 0;
        if (score >= 60) {
          const original = targetPool.find((t) => t.id === m.task_id);
          if (original) {
            matches.push({
              existingTask: original,
              similarityScore: score,
              reason: m.reason || 'Similar task found.',
              suggestedAction: m.suggested_action || 'merge_into_existing',
              mergedTitle: m.merged_title || original.title,
              mergedDescription: m.merged_description || original.description || undefined,
            });
            if (score > highestScore) highestScore = score;
          }
        }
      }
    }

    matches.sort((a, b) => b.similarityScore - a.similarityScore);

    return {
      hasDuplicate: highestScore >= 70,
      highestScore,
      matches,
    };
  } catch (err) {
    console.warn('[Task Similarity] AI analysis error, falling back to lexical matches:', err);
    // Graceful fallback to lexical candidates
    const fallbackMatches: TaskSimilarityMatch[] = candidates
      .filter((c) => c.score >= 50)
      .map((c) => ({
        existingTask: c.task,
        similarityScore: c.score,
        reason: `Lexically similar to existing task "${c.task.title}"`,
        suggestedAction: 'merge_into_existing',
        mergedTitle: c.task.title,
        mergedDescription: c.task.description || undefined,
      }));

    return {
      hasDuplicate: fallbackMatches.length > 0 && fallbackMatches[0].similarityScore >= 70,
      highestScore: fallbackMatches[0]?.similarityScore || 0,
      matches: fallbackMatches,
    };
  }
}
