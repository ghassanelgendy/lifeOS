import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  ArrowRight, 
  BookOpen, 
  GitGraph, 
  Globe, 
  Search, 
  X, 
  Menu, 
  Sun, 
  Moon, 
  ChevronRight, 
  ExternalLink,
  HelpCircle
} from 'lucide-react';
import { cn } from '../lib/utils';
import { WIKI_PAGES, getWikiPage, searchWikiPages, normalizeTitle } from '../lib/wikiData';
import WikiMarkdown from '../components/wiki/WikiMarkdown';
import WikiGraphView from '../components/wiki/WikiGraphView';
import { useUIStore } from '../stores/useUIStore';
import { useAuth } from '../contexts/AuthContext';

export default function Wiki() {
  const navigate = useNavigate();
  const { pageTitle } = useParams<{ pageTitle?: string }>();
  const { theme, setTheme } = useUIStore();
  const { user, loading: authLoading } = useAuth();

  const [isGraphView, setIsGraphView] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  /* Determine current page */
  const currentPage = useMemo(() => {
    if (!pageTitle) return getWikiPage('home');
    const decoded = decodeURIComponent(pageTitle);
    return getWikiPage(decoded) ?? getWikiPage('home');
  }, [pageTitle]);

  const navigateTo = useCallback(
    (title: string) => {
      const normalized = normalizeTitle(title);
      navigate(`/wiki/${encodeURIComponent(normalized)}`);
      setMobileMenuOpen(false);
      setIsGraphView(false); // Switch back to content view when navigating
    },
    [navigate]
  );

  /* Backlinks: pages that link TO current page */
  const backlinks = useMemo(() => {
    if (!currentPage) return [];
    const needle = `[[${currentPage.title}]]`;
    return WIKI_PAGES.filter(
      (p) => p.title !== currentPage.title && p.content.includes(needle)
    );
  }, [currentPage]);

  /* Outlinks: pages linked FROM current page */
  const outlinks = useMemo(() => {
    if (!currentPage) return [];
    const matches = currentPage.content.match(/\[\[([^\]]+)\]\]/g);
    if (!matches) return [];
    return [...new Set(matches.map((m) => normalizeTitle(m.slice(2, -2))))].filter(
      (t) => t !== currentPage.title
    );
  }, [currentPage]);

  /* Outline of the page based on headings */
  const outline = useMemo(() => {
    if (!currentPage || isGraphView) return [];
    const lines = currentPage.content.split('\n');
    const list: { text: string; id: string; level: number }[] = [];
    for (const line of lines) {
      const match = line.match(/^(#{2,4})\s+(.+)$/);
      if (match) {
        const level = match[1].length;
        const text = normalizeTitle(match[2]);
        const id = text
          .toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-');
        list.push({ text, id, level });
      }
    }
    return list;
  }, [currentPage, isGraphView]);

  /* Sidebar grouped by category */
  const groupedPages = useMemo(() => {
    const groups: Record<string, typeof WIKI_PAGES> = {};
    for (const p of WIKI_PAGES) {
      const cat = p.category;
      (groups[cat] ??= []).push(p);
    }
    return groups;
  }, []);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return searchWikiPages(searchQuery).slice(0, 8);
  }, [searchQuery]);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [searchOpen]);

  // Global keyboard shortcut (Ctrl+K or '/') to open search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      } else if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const scrollToHeading = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (!currentPage) return null;

  return (
    <div className="h-screen overflow-y-auto bg-background text-foreground flex flex-col font-sans selection:bg-primary/20">
      {/* Sticky Blurred Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/80 backdrop-blur-md shrink-0">
        <div className="flex h-16 items-center justify-between px-4 md:px-6 max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 -ml-2 hover:bg-secondary rounded-lg active:scale-95 transition-transform md:hidden"
              aria-label="Open documentation menu"
            >
              <Menu size={22} />
            </button>
            <Link to="/wiki" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
              <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                <BookOpen size={20} className="stroke-[2.5]" />
              </div>
              <span className="font-bold text-lg tracking-tight">lifeOS Docs</span>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            {/* Search Bar Button */}
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary/70 transition-colors mr-2 hidden sm:flex cursor-pointer"
            >
              <Search size={14} /> 
              <span>Search docs...</span>
              <kbd className="pointer-events-none select-none rounded border bg-background px-1.5 font-mono text-[9px] font-medium leading-none">
                Ctrl+K
              </kbd>
            </button>
            <button
              onClick={() => setSearchOpen(true)}
              className="p-2 hover:bg-secondary rounded-lg active:scale-95 transition-transform sm:hidden cursor-pointer"
              aria-label="Search documentation"
            >
              <Search size={18} />
            </button>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 hover:bg-secondary rounded-lg active:scale-95 transition-transform cursor-pointer mr-1"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* Portal Navigation Button */}
            {authLoading ? (
              <div className="w-24 h-8 rounded-lg bg-secondary/50 animate-pulse" />
            ) : user ? (
              <Link
                to="/dashboard"
                className="px-3.5 py-1.5 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors rounded-lg shadow-sm flex items-center gap-1.5"
              >
                <span>Go to App</span>
                <ArrowRight size={13} className="stroke-[2.5]" />
              </Link>
            ) : (
              <Link
                to="/login"
                className="px-3.5 py-1.5 text-xs font-semibold hover:bg-secondary border border-border transition-colors rounded-lg flex items-center gap-1.5"
              >
                <span>Log In</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Documentation Container */}
      <div className="flex-1 flex w-full max-w-7xl mx-auto px-4 md:px-6 gap-8 min-h-0 relative">
        
        {/* Left Sidebar (Desktop Navigation) */}
        <aside className="hidden md:block w-64 shrink-0 py-8 sticky top-16 max-h-[calc(100vh-4rem)] overflow-y-auto pr-2 border-r border-border/30 scrollbar-thin">
          <div className="space-y-6">
            {Object.entries(groupedPages).map(([cat, pages]) => (
              <div key={cat} className="space-y-2">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-2">
                  {cat}
                </h4>
                <ul className="space-y-1 border-l border-border/40 ml-2">
                  {pages.map((page) => {
                    const isActive = page.title === currentPage.title && !isGraphView;
                    return (
                      <li key={page.id}>
                        <button
                          onClick={() => navigateTo(page.title)}
                          className={cn(
                            'w-full text-left text-sm py-1.5 px-3 transition-all rounded-r-md block truncate border-l -ml-px',
                            isActive
                              ? 'font-medium text-primary border-primary bg-primary/5'
                              : 'text-muted-foreground hover:text-foreground border-transparent hover:border-border/60 hover:bg-secondary/20'
                          )}
                        >
                          {page.title}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </aside>

        {/* Mobile Slide-Over Sidebar Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            <div 
              className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity" 
              onClick={() => setMobileMenuOpen(false)} 
            />
            <div className="relative w-80 max-w-[85vw] bg-card border-r border-border h-full flex flex-col shadow-2xl p-6 overflow-y-auto animate-in slide-in-from-left duration-200">
              <div className="flex items-center justify-between pb-6 border-b border-border">
                <span className="font-bold text-lg">Documentation</span>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 hover:bg-secondary rounded-md"
                >
                  <X size={20} />
                </button>
              </div>
              <nav className="flex-1 py-6 space-y-6">
                {Object.entries(groupedPages).map(([cat, pages]) => (
                  <div key={cat} className="space-y-2">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      {cat}
                    </h4>
                    <ul className="space-y-1 border-l border-border/40 ml-1">
                      {pages.map((page) => {
                        const isActive = page.title === currentPage.title && !isGraphView;
                        return (
                          <li key={page.id}>
                            <button
                              onClick={() => navigateTo(page.title)}
                              className={cn(
                                'w-full text-left text-sm py-2 px-3 transition-colors rounded-r-md block truncate border-l -ml-px',
                                isActive
                                  ? 'font-medium text-primary border-primary bg-primary/5'
                                  : 'text-muted-foreground hover:text-foreground border-transparent'
                              )}
                            >
                              {page.title}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </nav>
            </div>
          </div>
        )}

        {/* Center Main Content Panel */}
        <main className="flex-1 min-w-0 py-8">
          {isGraphView ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-4 border-b border-border">
                <div>
                  <h1 className="text-3xl font-extrabold tracking-tight">Knowledge Graph</h1>
                  <p className="text-muted-foreground text-sm mt-1">Interactive network mapping document links and references</p>
                </div>
                <button
                  onClick={() => setIsGraphView(false)}
                  className="px-3.5 py-1.5 text-xs font-medium border border-border hover:bg-secondary rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft size={14} /> Back to Page
                </button>
              </div>
              <div className="bg-card rounded-2xl border border-border p-4 shadow-sm overflow-hidden flex justify-center">
                <WikiGraphView onNavigate={navigateTo} />
              </div>
            </div>
          ) : (
            <article className="space-y-6">
              {/* Document Meta Header */}
              <div className="space-y-2 pb-6 border-b border-border">
                <div className="flex items-center gap-2 text-xs text-primary font-medium tracking-wide uppercase">
                  <span>{currentPage.category}</span>
                  <span>·</span>
                  <span>System Documentation</span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                  {currentPage.title}
                </h1>
                <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                  <span>References: {outlinks.length} outgoing</span>
                  <span>·</span>
                  <span>Referenced by: {backlinks.length} incoming</span>
                </div>
              </div>

              {/* Document Body */}
              <div className="min-h-[300px]">
                <WikiMarkdown content={currentPage.content} onNavigate={navigateTo} />
              </div>

              {/* Mobile Backlinks/Outlinks Section (Bottom of Page) */}
              <div className="pt-8 mt-12 border-t border-border space-y-6 lg:hidden">
                <button
                  onClick={() => setIsGraphView(true)}
                  className="w-full py-3 border border-border rounded-xl bg-card hover:bg-secondary/40 transition-colors font-medium text-sm flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                >
                  <GitGraph size={16} className="text-primary" />
                  <span>Open Interactive Knowledge Graph</span>
                </button>

                {outlinks.length > 0 && (
                  <div className="space-y-2.5">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Outgoing Links</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {outlinks.map((link) => {
                        const exists = !!getWikiPage(link);
                        return (
                          <button
                            key={link}
                            onClick={() => navigateTo(link)}
                            className={cn(
                              'text-sm p-3 rounded-lg border text-left truncate flex items-center justify-between',
                              exists 
                                ? 'bg-card border-border hover:border-primary/50 text-foreground' 
                                : 'bg-secondary/10 border-border/50 text-muted-foreground italic'
                            )}
                          >
                            <span>{link}</span>
                            <ChevronRight size={14} className="text-muted-foreground/60 shrink-0" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {backlinks.length > 0 && (
                  <div className="space-y-2.5">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Incoming Backlinks</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {backlinks.map((page) => (
                        <button
                          key={page.id}
                          onClick={() => navigateTo(page.title)}
                          className="text-sm p-3 rounded-lg border bg-card border-border hover:border-primary/50 text-left truncate flex items-center justify-between"
                        >
                          <span>{page.title}</span>
                          <ChevronRight size={14} className="text-muted-foreground/60 shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </article>
          )}
        </main>

        {/* Right Sidebar (Table of Contents & Meta Links - Desktop Only) */}
        <aside className="hidden lg:block w-60 shrink-0 py-8 sticky top-16 max-h-[calc(100vh-4rem)] overflow-y-auto pl-2 border-l border-border/30 scrollbar-thin space-y-6">
          
          {/* Graph View Toggle */}
          <div>
            <button
              onClick={() => setIsGraphView((v) => !v)}
              className={cn(
                'w-full py-2 px-3.5 rounded-lg border text-sm font-medium transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer',
                isGraphView
                  ? 'bg-primary text-primary-foreground border-primary hover:bg-primary/95'
                  : 'bg-card border-border hover:bg-secondary/50 text-foreground'
              )}
            >
              <GitGraph size={15} />
              <span>{isGraphView ? 'Close Graph' : 'Open Knowledge Graph'}</span>
            </button>
          </div>

          {/* On This Page Outline */}
          {outline.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                On This Page
              </h4>
              <ul className="space-y-2 text-xs border-l border-border/60">
                {outline.map((item) => (
                  <li 
                    key={item.id}
                    style={{ paddingLeft: `${(item.level - 2) * 8 + 12}px` }}
                    className="-ml-px border-l border-transparent hover:border-muted-foreground/30"
                  >
                    <button
                      onClick={() => scrollToHeading(item.id)}
                      className="text-muted-foreground hover:text-foreground text-left transition-colors leading-relaxed block max-w-full truncate"
                    >
                      {item.text}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Outlinks */}
          {outlinks.length > 0 && !isGraphView && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Outgoing Links
              </h4>
              <ul className="space-y-1.5">
                {outlinks.map((link) => {
                  const exists = !!getWikiPage(link);
                  return (
                    <li key={link}>
                      <button
                        onClick={() => navigateTo(link)}
                        className={cn(
                          'text-xs text-left w-full truncate block hover:underline transition-colors',
                          exists ? 'text-primary' : 'text-muted-foreground italic'
                        )}
                      >
                        {link}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Backlinks */}
          {backlinks.length > 0 && !isGraphView && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Backlinks
              </h4>
              <ul className="space-y-1.5">
                {backlinks.map((page) => (
                  <li key={page.id}>
                    <button
                      onClick={() => navigateTo(page.title)}
                      className="text-xs text-primary hover:underline text-left w-full truncate block"
                    >
                      {page.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>

      {/* Search Modal */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-start justify-center pt-[15vh] px-4 animate-in fade-in duration-150"
          onClick={() => setSearchOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 p-4 border-b border-border">
              <Search size={18} className="text-muted-foreground shrink-0" />
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search documentation (Press Esc to exit)..."
                className="flex-1 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setSearchOpen(false);
                }}
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 hover:bg-secondary rounded"
              >
                <X size={16} />
              </button>
            </div>
            <div className="max-h-[50vh] overflow-y-auto p-2">
              {searchResults.length === 0 && searchQuery.trim() && (
                <div className="p-4 text-sm text-muted-foreground text-center">
                  No documentation pages found matching “<strong>{searchQuery}</strong>”
                </div>
              )}
              {searchResults.length === 0 && !searchQuery.trim() && (
                <div className="p-4 text-xs text-muted-foreground text-center">
                  Type query to search headings or page contents...
                </div>
              )}
              {searchResults.map((page) => (
                <button
                  key={page.id}
                  type="button"
                  onClick={() => {
                    setSearchOpen(false);
                    setSearchQuery('');
                    navigateTo(page.title);
                  }}
                  className="w-full text-left p-3 hover:bg-secondary/60 transition-colors border border-transparent hover:border-border rounded-lg flex items-center justify-between mb-1 last:mb-0"
                >
                  <div>
                    <div className="flex items-center gap-2 text-[10px] text-primary font-semibold uppercase tracking-wider mb-0.5">
                      <span
                        className={cn(
                          'inline-block h-1.5 w-1.5 rounded-full',
                          page.category === 'Getting Started'
                            ? 'bg-blue-500'
                            : page.category === 'Core Features'
                              ? 'bg-emerald-500'
                              : page.category === 'Technical Deep Dives'
                                ? 'bg-violet-500'
                                : 'bg-amber-500'
                        )}
                      />
                      {page.category}
                    </div>
                    <div className="font-semibold text-sm text-foreground">{page.title}</div>
                  </div>
                  <ChevronRight size={14} className="text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
