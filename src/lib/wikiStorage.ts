import type { WikiPage } from '../types/wiki';
import { v4 as uuidv4 } from 'uuid';

const WIKI_PAGES_KEY = 'lifeos_wiki_pages';

export function normalizeTitle(title: string): string {
  return title
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\[\[|\]\]/g, '')
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function loadPages(): WikiPage[] {
  try {
    const raw = localStorage.getItem(WIKI_PAGES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as WikiPage[];
  } catch {
    return [];
  }
}

function savePages(pages: WikiPage[]) {
  localStorage.setItem(WIKI_PAGES_KEY, JSON.stringify(pages));
}

export function getAllPages(): WikiPage[] {
  return loadPages();
}

export function getPageByTitle(title: string): WikiPage | undefined {
  const normalized = normalizeTitle(title);
  return loadPages().find((p) => p.title === normalized);
}

export function getPageById(id: string): WikiPage | undefined {
  return loadPages().find((p) => p.id === id);
}

export function savePage(title: string, content: string): WikiPage {
  const pages = loadPages();
  const normalizedTitle = normalizeTitle(title);
  const now = new Date().toISOString();

  const existing = pages.find((p) => p.title === normalizedTitle);
  if (existing) {
    existing.content = content;
    existing.updated_at = now;
    savePages(pages);
    return existing;
  }

  const newPage: WikiPage = {
    id: uuidv4(),
    title: normalizedTitle,
    content,
    created_at: now,
    updated_at: now,
  };
  pages.push(newPage);
  savePages(pages);
  return newPage;
}

export function deletePage(title: string): boolean {
  const pages = loadPages();
  const normalized = normalizeTitle(title);
  const filtered = pages.filter((p) => p.title !== normalized);
  if (filtered.length === pages.length) return false;
  savePages(filtered);
  return true;
}

export function searchPages(query: string): WikiPage[] {
  const q = query.trim().toLowerCase();
  if (!q) return loadPages();
  return loadPages().filter(
    (p) =>
      p.title.toLowerCase().includes(q) ||
      p.content.toLowerCase().includes(q)
  );
}

/* Extract all [[Wiki Links]] from a markdown string */
export function extractWikiLinks(content: string): string[] {
  const matches = content.match(/\[\[([^\]]+)\]\]/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => normalizeTitle(m.slice(2, -2))))];
}

/* Build bidirectional link graph from all pages */
export function getLinkGraph(): { nodes: string[]; edges: { source: string; target: string }[] } {
  const pages = loadPages();
  const nodes = pages.map((p) => p.title);
  const edges: { source: string; target: string }[] = [];

  for (const page of pages) {
    const links = extractWikiLinks(page.content);
    for (const link of links) {
      if (link !== page.title) {
        edges.push({ source: page.title, target: link });
      }
    }
  }

  return { nodes, edges };
}

/* Seed with a welcome page if empty */
export function seedWikiIfEmpty() {
  const pages = loadPages();
  if (pages.length > 0) return;

  const welcomeContent = `# Welcome to Your Wiki

This is your personal knowledge base inspired by [[Logseq]].

## How to use

- Create pages by typing **[[Page Name]]** in the editor
- Click any link to navigate to that page
- If a page doesn't exist, you'll be prompted to create it
- Use the **Graph** tab to see how your pages connect

## Formatting

You can use regular **markdown** here:
- Lists
- *Italics* or **bold**
- # Headers
- \`inline code\`

Happy writing!`;

  savePage('Welcome', welcomeContent);
}
