import { create } from 'zustand';
import type { WikiPage } from '../types/wiki';
import {
  getAllPages,
  getPageByTitle,
  savePage as storageSavePage,
  deletePage as storageDeletePage,
  searchPages,
  seedWikiIfEmpty,
  normalizeTitle,
} from '../lib/wikiStorage';

interface WikiState {
  pages: WikiPage[];
  currentTitle: string | null;
  isGraphView: boolean;
  searchQuery: string;
  searchResults: WikiPage[];

  // Actions
  loadPages: () => void;
  navigateTo: (title: string) => void;
  saveCurrentPage: (title: string, content: string) => void;
  deleteCurrentPage: () => void;
  toggleGraphView: () => void;
  setSearchQuery: (query: string) => void;
  createPage: (title: string) => void;
  getBacklinks: (title: string) => WikiPage[];
}

export const useWikiStore = create<WikiState>((set, get) => ({
  pages: [],
  currentTitle: null,
  isGraphView: false,
  searchQuery: '',
  searchResults: [],

  loadPages: () => {
    seedWikiIfEmpty();
    const pages = getAllPages();
    set({ pages, currentTitle: pages[0]?.title ?? null });
  },

  navigateTo: (title) => {
    const normalized = normalizeTitle(title);
    set({ currentTitle: normalized, isGraphView: false });
  },

  saveCurrentPage: (title, content) => {
    const saved = storageSavePage(title, content);
    const pages = getAllPages();
    set({ pages, currentTitle: saved.title });
  },

  deleteCurrentPage: () => {
    const { currentTitle } = get();
    if (!currentTitle) return;
    storageDeletePage(currentTitle);
    const pages = getAllPages();
    set({ pages, currentTitle: pages[0]?.title ?? null });
  },

  toggleGraphView: () => {
    set((state) => ({ isGraphView: !state.isGraphView }));
  },

  setSearchQuery: (query) => {
    const results = searchPages(query);
    set({ searchQuery: query, searchResults: results });
  },

  createPage: (title) => {
    const normalized = normalizeTitle(title);
    const existing = getPageByTitle(normalized);
    if (!existing) {
      storageSavePage(normalized, `# ${normalized}\n\nStart writing...`);
      const pages = getAllPages();
      set({ pages, currentTitle: normalized });
    } else {
      set({ currentTitle: normalized });
    }
  },

  getBacklinks: (title) => {
    const normalized = normalizeTitle(title);
    return getAllPages().filter((p) =>
      p.content.includes(`[[${normalized}]]`)
    );
  },
}));
