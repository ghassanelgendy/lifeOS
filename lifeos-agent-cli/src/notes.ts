import fs from "node:fs/promises";
import path from "node:path";

import type { NotesSearchHit } from "./types.js";

interface NoteDoc {
  path: string;
  title: string;
  content: string;
}

interface SerializedIndex {
  builtAt: string;
  vaultPath: string;
  docs: NoteDoc[];
}

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "to",
  "for",
  "of",
  "in",
  "on",
  "is",
  "it",
  "with",
  "that",
  "this",
  "as",
  "be",
  "at",
  "by",
  "from",
  "are",
  "was",
  "were",
  "been",
  "has",
  "have",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "can",
  "not",
  "no",
  "but",
  "so",
  "if",
  "my",
  "me",
  "i",
  "we",
  "you",
  "your",
  "what",
  "how",
  "when",
  "where",
  "which",
  "who",
]);

function stem(word: string): string {
  if (word.length <= 3) {
    return word;
  }

  if (word.endsWith("ies") && word.length > 4) {
    return word.slice(0, -3) + "y";
  }
  if (word.endsWith("sses")) {
    return word.slice(0, -2);
  }
  if (word.endsWith("ness")) {
    return word.slice(0, -4);
  }
  if (word.endsWith("ment") && word.length > 5) {
    return word.slice(0, -4);
  }
  if (word.endsWith("ing") && word.length > 5) {
    const base = word.slice(0, -3);
    if (base.endsWith("e")) {
      return base;
    }
    if (base.length > 2 && base[base.length - 1] === base[base.length - 2]) {
      return base.slice(0, -1);
    }
    return base;
  }
  if (word.endsWith("tion") || word.endsWith("sion")) {
    return word.slice(0, -3) + "e";
  }
  if (word.endsWith("able") || word.endsWith("ible")) {
    return word.slice(0, -4);
  }
  if (word.endsWith("ful")) {
    return word.slice(0, -3);
  }
  if (word.endsWith("ous") || word.endsWith("ive")) {
    return word.slice(0, -3) + "e";
  }
  if (word.endsWith("ally")) {
    return word.slice(0, -4);
  }
  if (word.endsWith("ly") && word.length > 4) {
    return word.slice(0, -2);
  }
  if (word.endsWith("ed") && word.length > 4) {
    const base = word.slice(0, -2);
    if (base.length > 2 && base[base.length - 1] === base[base.length - 2]) {
      return base.slice(0, -1);
    }
    return base;
  }
  if (word.endsWith("er") && word.length > 4) {
    return word.slice(0, -2);
  }
  if (word.endsWith("est") && word.length > 5) {
    return word.slice(0, -3);
  }
  if (word.endsWith("s") && !word.endsWith("ss") && word.length > 3) {
    return word.slice(0, -1);
  }

  return word;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

function tokenizeAndStem(text: string): string[] {
  return tokenize(text).map(stem);
}

function scoreDoc(queryTokens: string[], doc: NoteDoc): number {
  const titleTokens = tokenizeAndStem(doc.title);
  const contentTokens = tokenizeAndStem(doc.content);
  const allTokens = [...titleTokens, ...contentTokens];
  if (!allTokens.length || !queryTokens.length) {
    return 0;
  }

  const freq = new Map<string, number>();
  for (const token of allTokens) {
    freq.set(token, (freq.get(token) ?? 0) + 1);
  }

  const titleFreq = new Map<string, number>();
  for (const token of titleTokens) {
    titleFreq.set(token, (titleFreq.get(token) ?? 0) + 1);
  }

  let score = 0;
  for (const token of queryTokens) {
    const contentHits = freq.get(token) ?? 0;
    const titleHits = titleFreq.get(token) ?? 0;
    score += contentHits + titleHits * 3;
  }

  return score / Math.sqrt(allTokens.length);
}

function makeSnippet(content: string, queryTokens: string[]): string {
  const lowered = content.toLowerCase();
  const anchor = queryTokens.find((t) => lowered.includes(t));
  if (!anchor) {
    return content.slice(0, 280).replace(/\s+/g, " ").trim();
  }

  const anchorIndex = lowered.indexOf(anchor);
  const start = Math.max(0, anchorIndex - 100);
  const end = Math.min(content.length, anchorIndex + 180);
  return content.slice(start, end).replace(/\s+/g, " ").trim();
}

async function walkMarkdownFiles(root: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.startsWith(".")) {
          continue;
        }
        await walk(full);
        continue;
      }

      if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
        files.push(full);
      }
    }
  }

  await walk(root);
  return files;
}

export async function buildNotesIndex(
  vaultPath: string,
  cacheDir: string,
): Promise<{ count: number; cacheFile: string }> {
  const markdownFiles = await walkMarkdownFiles(vaultPath);
  const docs: NoteDoc[] = [];

  for (const file of markdownFiles) {
    const content = await fs.readFile(file, "utf8");
    const relPath = path.relative(vaultPath, file).replaceAll("\\", "/");
    docs.push({
      path: relPath,
      title: path.basename(file, path.extname(file)),
      content,
    });
  }

  await fs.mkdir(cacheDir, { recursive: true });
  const cacheFile = path.join(cacheDir, "notes-index.json");
  const payload: SerializedIndex = {
    builtAt: new Date().toISOString(),
    vaultPath,
    docs,
  };

  await fs.writeFile(cacheFile, JSON.stringify(payload, null, 2), "utf8");
  return { count: docs.length, cacheFile };
}

export async function loadNotesIndex(cacheDir: string): Promise<SerializedIndex | null> {
  const cacheFile = path.join(cacheDir, "notes-index.json");

  try {
    const text = await fs.readFile(cacheFile, "utf8");
    return JSON.parse(text) as SerializedIndex;
  } catch {
    return null;
  }
}

export function searchNotes(
  index: SerializedIndex,
  query: string,
  topK = 5,
): NotesSearchHit[] {
  const rawTokens = tokenize(query);
  const stemmedTokens = rawTokens.map(stem);
  const scored = index.docs
    .map((doc) => ({
      doc,
      score: scoreDoc(stemmedTokens, doc),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((x) => ({
      path: x.doc.path,
      title: x.doc.title,
      score: Number(x.score.toFixed(3)),
      snippet: makeSnippet(x.doc.content, rawTokens),
    }));

  return scored;
}
