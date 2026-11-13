import { Menu, X, Sparkles, Brain } from 'lucide-react';
import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { cn } from './ui/cn';
import { NavLink, Outlet, useMatch, useLocation, useNavigate } from 'react-router-dom';
import { CommandPalette } from './CommandPalette';
import { useUIStore } from '../stores/useUIStore';
import { PullToRefresh } from './PullToRefresh';
import { OfflineBanner } from './OfflineBanner';
import { AppFooter } from './AppFooter';
import { FocusSessionManager } from './FocusSessionManager';
import { FocusPiPWindow } from './FocusPiPWindow';
import { BrainDumpModal } from './BrainDumpModal';
import { AIChatModal } from './AIChatModal';
import { NAV_ITEMS, type NavItem } from './navItems';
import { DEFAULT_DESKTOP_NAV } from '../stores/useUIStore';
import { checkWrapStatus } from '../lib/wrapHelpers';
import { AppJoyrideTour } from './AppJoyrideTour';
import { useAuth } from '../hooks/useAuth';
import { UserBlobatar } from './ui/UserBlobatar';
import { IconButton } from './ui/IconButton';

function MobileNavLink({
  item,
  isMobileSidebarOpen,
  setMobileSidebarOpen,
  showDot,
}: {
  item: NavItem;
  isMobileSidebarOpen: boolean;
  setMobileSidebarOpen: (open: boolean) => void;
  showDot?: boolean;
}) {
  const match = useMatch({ path: item.href, end: item.href === '/' });
  const isActive = !!match;
  const Icon = item.icon;

  const handleClick = () => {
    if (isMobileSidebarOpen) {
      setMobileSidebarOpen(false);
      return;
    }

    if (isActive) {
      // Smoothly scroll active page to top on tap
      const scrollRoot = document.querySelector('[data-lifeos-scroll-root]');
      if (scrollRoot) {
        scrollRoot.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  return (
    <NavLink
      to={item.href}
      end={item.href === '/'}
      onClick={handleClick}
      className={({ isActive: active }) => cn(
        "flex flex-col items-center justify-center flex-1 h-full py-1 active:scale-95 transition-colors duration-150 relative select-none touch-manipulation",
        active ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
      )}
    >
      <div className={cn(
        "relative flex items-center justify-center px-3.5 py-1 rounded-full transition-colors duration-200",
        isActive ? "bg-primary/10 text-primary" : "text-muted-foreground"
      )}>
        <Icon size={20} strokeWidth={isActive ? 2.4 : 1.9} />
        {showDot && (
          <span className="absolute top-1 right-2 inline-flex rounded-full h-2 w-2 bg-rose-500" />
        )}
      </div>
      <span className={cn(
        "text-[11px] mt-0.5 tracking-tight transition-colors",
        isActive ? "text-foreground font-semibold" : "text-muted-foreground"
      )}>
        {item.label}
      </span>
    </NavLink>
  );
}

const SWIPE_EDGE_PX = 24;

export function AppShell() {
  const {
    isSidebarCollapsed,
    toggleSidebar,
    mobileNavItems,
    pinnedNavItems,
    desktopNavOrder,
    desktopNavVisible,
    isMobileSidebarOpen,
    setMobileSidebarOpen,
    lastViewedWeeklyWrap,
    lastViewedMonthlyWrap,
    lastNotifiedWeeklyWrap,
    lastNotifiedMonthlyWrap,
    setLastNotifiedWeeklyWrap,
    setLastNotifiedMonthlyWrap,
    showAppFooter,
    aiEnabled,
  } = useUIStore();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const [isBrainDumpOpen, setIsBrainDumpOpen] = useState(false);
  const [brainDumpInitialText, setBrainDumpInitialText] = useState('');
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const [chatModalPrompt, setChatModalPrompt] = useState('');

  // First visit on a wide screen: show labels. The store default (collapsed) is
  // shared with pake, so this is a one-time web-only override; the user's later
  // toggle is persisted by the store as before.
  useEffect(() => {
    try {
      if (localStorage.getItem('lifeos-web-sidebar-init')) return;
      localStorage.setItem('lifeos-web-sidebar-init', '1');
      if (window.innerWidth >= 1280) useUIStore.setState({ isSidebarCollapsed: false });
    } catch { /* storage unavailable: keep store default */ }
  }, []);

  useEffect(() => {
    const handleOpenBrainDump = (e: Event) => {
      const customEvent = e as CustomEvent<{ text?: string; autoAnalyze?: boolean }>;
      if (customEvent.detail?.text) {
        setBrainDumpInitialText(customEvent.detail.text);
      }
      setIsBrainDumpOpen(true);
    };

    const handleOpenAIChat = (e: Event) => {
      const customEvent = e as CustomEvent<{ prompt?: string }>;
      setChatModalPrompt(customEvent.detail?.prompt || '');
      setIsChatModalOpen(true);
    };

    window.addEventListener('lifeos:openBrainDump', handleOpenBrainDump as EventListener);
    window.addEventListener('lifeos:openAIChat', handleOpenAIChat as EventListener);

    // Handle deep links / launcher shortcuts / web share target from URL query params
    const searchParams = new URLSearchParams(window.location.search);
    const openParam = searchParams.get('open');
    const shareText = searchParams.get('share_text') || searchParams.get('text');
    const shareUrl = searchParams.get('share_url') || searchParams.get('url');
    const shareTitle = searchParams.get('share_title') || searchParams.get('title');

    if (openParam === 'braindump' || shareText || shareUrl) {
      const combinedText = [shareTitle, shareText, shareUrl].filter(Boolean).join('\n');
      if (combinedText) {
        setBrainDumpInitialText(combinedText);
      }
      setIsBrainDumpOpen(true);

      // Clean up URL parameters without full page reload
      searchParams.delete('open');
      searchParams.delete('share_text');
      searchParams.delete('share_url');
      searchParams.delete('share_title');
      searchParams.delete('text');
      searchParams.delete('url');
      searchParams.delete('title');
      const newQuery = searchParams.toString();
      const newRelativePathQuery = window.location.pathname + (newQuery ? `?${newQuery}` : '');
      window.history.replaceState(null, '', newRelativePathQuery);
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = (e.key || '').toLowerCase();
      const code = (e.code || '').toLowerCase();

      // Ctrl + B or Cmd + B (also Alt + B for compatibility)
      const isCtrlB = ((e.ctrlKey || e.metaKey || e.altKey) && (key === 'b' || code === 'keyb' || key === 'لا'));
      if (isCtrlB) {
        // Prevent default only if not in contentEditable or input
        const active = document.activeElement;
        const isTyping = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.getAttribute('contenteditable') === 'true');
        // If typing in rich editor, Ctrl+B might be bold, so let Alt+B override or Ctrl+B if not editing text
        if (!isTyping || e.altKey) {
          e.preventDefault();
          e.stopPropagation();
          setIsBrainDumpOpen((v) => !v);
          return;
        }
      }

      // Ctrl + A or Cmd + A when not in input/textarea (or Alt + A / Ctrl+Shift+A) -> Open AI Assistant Modal
      const active = document.activeElement;
      const isTyping = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.getAttribute('contenteditable') === 'true');
      const isCtrlA = ((e.ctrlKey || e.metaKey) && (key === 'a' || code === 'keya' || key === 'ش') && !isTyping) ||
                      (e.altKey && (key === 'a' || code === 'keya' || key === 'ش')) ||
                      ((e.ctrlKey || e.metaKey) && e.shiftKey && (key === 'a' || code === 'keya'));

      if (isCtrlA) {
        e.preventDefault();
        e.stopPropagation();
        const selectedText = window.getSelection()?.toString().trim() || '';
        setChatModalPrompt(selectedText);
        setIsChatModalOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handleKeyDown, { capture: true });

    return () => {
      window.removeEventListener('lifeos:openBrainDump', handleOpenBrainDump as EventListener);
      window.removeEventListener('lifeos:openAIChat', handleOpenAIChat as EventListener);
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, []);

  const { isWeeklyWrapDay, isMonthlyWrapDay, weeklyWrapKey, monthlyWrapKey } = checkWrapStatus();

  const showWrappedTakeover = useMemo(() => {
    const showWeekly = isWeeklyWrapDay && lastViewedWeeklyWrap !== weeklyWrapKey;
    const showMonthly = isMonthlyWrapDay && lastViewedMonthlyWrap !== monthlyWrapKey;
    return showWeekly || showMonthly;
  }, [isWeeklyWrapDay, isMonthlyWrapDay, lastViewedWeeklyWrap, lastViewedMonthlyWrap, weeklyWrapKey, monthlyWrapKey]);

  const mobileNavigationMapped = useMemo(() => {
    const rawItems = NAV_ITEMS.filter(item => (aiEnabled || item.href !== '/chat') && mobileNavItems.includes(item.href));
    return rawItems.map(item => {
      if (item.href === '/settings' && showWrappedTakeover) {
        return {
          label: isMonthlyWrapDay && !isWeeklyWrapDay ? 'Monthly Wrap' : 'Weekly Wrap',
          icon: Sparkles,
          href: '/analytics'
        };
      }
      return item;
    });
  }, [mobileNavItems, showWrappedTakeover, isWeeklyWrapDay, isMonthlyWrapDay, aiEnabled]);

  const currentNavLabel = useMemo(() => {
    if (location.pathname === '/' || location.pathname === '/dashboard') return 'Dashboard';
    if (location.pathname === '/settings') return 'Settings';
    if (location.pathname === '/points') return 'Points & Rewards';
    if (location.pathname === '/quran') return 'Quran Memorizer';
    if (location.pathname === '/azkar') return 'Daily Azkar';
    const found = NAV_ITEMS.find((nav) =>
      location.pathname === nav.href || location.pathname.startsWith(nav.href + '/')
    );
    return found?.label || 'LifeOS';
  }, [location.pathname]);

  const desktopNavigation = useMemo(() => {
    const navItems = NAV_ITEMS.filter((item) => item.href !== '/settings' && (aiEnabled || item.href !== '/chat'));
    const fallback = [...DEFAULT_DESKTOP_NAV];
    const savedOrder = (desktopNavOrder.length ? desktopNavOrder : fallback)
      .map((href) => navItems.find((item) => item.href === href))
      .filter((item): item is NavItem => !!item);
    const missing = navItems.filter((item) => !savedOrder.some((saved) => saved.href === item.href));
    return [...savedOrder, ...missing].filter((item) => desktopNavVisible[item.href] !== false);
  }, [desktopNavOrder, desktopNavVisible, aiEnabled]);

  // Drawer items pinned to the horizontal icon-only row up top (in user's chosen order),
  // with the rest of desktopNavigation below as the regular vertical list (matching iOS).
  const pinnedDrawerItems = useMemo(
    () => (pinnedNavItems || [])
      .map((href) => desktopNavigation.find((item) => item.href === href))
      .filter((item): item is NavItem => !!item),
    [pinnedNavItems, desktopNavigation]
  );
  const unpinnedDrawerItems = useMemo(
    () => desktopNavigation.filter((item) => !(pinnedNavItems || []).includes(item.href)),
    [desktopNavigation, pinnedNavItems]
  );

  const isOnTasks = location.pathname === '/tasks';
  const isOnNotes = location.pathname === '/notes';

  const [activeToast, setActiveToast] = useState<'weekly' | 'monthly' | null>(null);

  useEffect(() => {
    let localNotifiedWeekly: string | null = null;
    let localNotifiedMonthly: string | null = null;
    try {
      localNotifiedWeekly = localStorage.getItem('local_notified_weekly_wrap');
      localNotifiedMonthly = localStorage.getItem('local_notified_monthly_wrap');
    } catch (e) {
      console.warn("Storage read failed:", e);
    }

    console.log("Wrapped check:", {
      isWeeklyWrapDay,
      lastNotifiedWeeklyWrap,
      weeklyWrapKey,
      lastViewedWeeklyWrap,
      localNotifiedWeekly,
      isMonthlyWrapDay,
      lastNotifiedMonthlyWrap,
      monthlyWrapKey,
      lastViewedMonthlyWrap,
      localNotifiedMonthly
    });

    if (isWeeklyWrapDay && 
        lastNotifiedWeeklyWrap !== weeklyWrapKey && 
        lastViewedWeeklyWrap !== weeklyWrapKey && 
        localNotifiedWeekly !== weeklyWrapKey
    ) {
      setActiveToast('weekly');
      setLastNotifiedWeeklyWrap(weeklyWrapKey);
      try {
        localStorage.setItem('local_notified_weekly_wrap', weeklyWrapKey);
      } catch (e) {
        console.warn("Storage write failed:", e);
      }
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification("Weekly Wrapped is Ready!", {
            body: "Check out your weekly summary, trends, and achievements in the Analytics tab!",
            icon: "/web-app-manifest-192x192.png"
          });
        } catch {
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then((reg) => {
              reg.showNotification("Weekly Wrapped is Ready!", {
                body: "Check out your weekly summary, trends, and achievements in the Analytics tab!",
                icon: "/web-app-manifest-192x192.png"
              });
            }).catch(() => {});
          }
        }
      }
    } else if (isMonthlyWrapDay && 
               !isWeeklyWrapDay &&
               lastNotifiedMonthlyWrap !== monthlyWrapKey && 
               lastViewedMonthlyWrap !== monthlyWrapKey && 
               localNotifiedMonthly !== monthlyWrapKey
    ) {
      setActiveToast('monthly');
      setLastNotifiedMonthlyWrap(monthlyWrapKey);
      try {
        localStorage.setItem('local_notified_monthly_wrap', monthlyWrapKey);
      } catch (e) {
        console.warn("Storage write failed:", e);
      }
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification("Monthly Wrapped is Ready!", {
            body: "Check out your monthly summary and insights in the Analytics tab!",
            icon: "/web-app-manifest-192x192.png"
          });
        } catch {
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then((reg) => {
              reg.showNotification("Monthly Wrapped is Ready!", {
                body: "Check out your monthly summary and insights in the Analytics tab!",
                icon: "/web-app-manifest-192x192.png"
              });
            }).catch(() => {});
          }
        }
      }
    }
  }, [
    isWeeklyWrapDay,
    isMonthlyWrapDay,
    weeklyWrapKey,
    monthlyWrapKey,
    lastNotifiedWeeklyWrap,
    lastNotifiedMonthlyWrap,
    lastViewedWeeklyWrap,
    lastViewedMonthlyWrap,
    setLastNotifiedWeeklyWrap,
    setLastNotifiedMonthlyWrap
  ]);

  const isOnQuran = location.pathname.startsWith('/quran');

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isOnQuran) return;
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  }, [isOnQuran]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (isOnQuran || !touchStart.current) return;
    const t = e.touches[0];
    const deltaX = t.clientX - touchStart.current.x;
    const deltaY = t.clientY - touchStart.current.y;
    const horizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 15;
    const fromLeftEdge = touchStart.current.x < SWIPE_EDGE_PX;
    if (horizontalSwipe && fromLeftEdge) {
      e.preventDefault();
    }
  }, [isOnQuran]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (isOnQuran || !touchStart.current) return;
    const t = e.changedTouches[0];
    const deltaX = t.clientX - touchStart.current.x;

    // Swipe from left edge on ANY page → open mobile sidebar
    if (touchStart.current.x < SWIPE_EDGE_PX && deltaX > 40) {
      setMobileSidebarOpen(true);
      touchStart.current = null;
      return;
    }

    touchStart.current = null;
  }, [isOnQuran, setMobileSidebarOpen]);

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] w-full overflow-hidden bg-background text-foreground font-sans">
      <CommandPalette />
      {/* Mobile drawer (slide from left) - iOS-style floating glassmorphic card */}
      <>
        <div
          className={cn(
            "md:hidden fixed inset-0 z-[270] bg-black/50 transition-opacity duration-150",
            isMobileSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden
        />
        <aside
          className={cn(
            "md:hidden fixed z-[280] w-[min(20rem,85vw)] min-w-[16rem] flex flex-col transition-transform duration-250 ease-out will-change-transform transform-gpu rounded-[24px]",
            "bg-[#F9F9F9]/90 dark:bg-[#1C1C1E]/90 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-2xl",
            isMobileSidebarOpen ? "translate-x-0" : "-translate-x-[calc(100%+24px)]"
          )}
          style={{ 
            top: 'calc(12px + env(safe-area-inset-top))', 
            left: '12px',
            height: 'calc(100dvh - 24px - env(safe-area-inset-top) - env(safe-area-inset-bottom))'
          }}
        >
          <div className="flex h-11 items-center justify-between px-4 border-b border-border/40 shrink-0">
            <span className="text-base font-bold tracking-tight">LifeOS</span>
            <button 
              onClick={() => setMobileSidebarOpen(false)} 
              className="p-1.5 hover:bg-secondary/60 rounded-full active:scale-95 transition-transform touch-manipulation text-muted-foreground"
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          </div>
          {pinnedDrawerItems.length > 0 && (
            <div className="flex items-center justify-around gap-1 px-2.5 py-2 border-b border-border/40 shrink-0">
              {pinnedDrawerItems.map((item) => (
                <NavLink
                  key={item.href}
                  to={item.href}
                  end={item.href === '/'}
                  aria-label={item.label}
                  className={({ isActive }) => cn(
                    "flex flex-col items-center justify-center gap-1 rounded-xl p-2 min-w-[3.25rem] transition-colors hover:bg-secondary/50",
                    isActive ? "bg-primary/10 text-primary" : "text-muted-foreground"
                  )}
                  onClick={() => setMobileSidebarOpen(false)}
                >
                  <item.icon size={22} className="shrink-0" />
                </NavLink>
              ))}
            </div>
          )}
          {/* Rows are deliberately compact (44px) so all nav entries fit on a phone screen with little or no scrolling */}
          <nav data-tour="sidebar-nav" className="flex-1 overflow-y-auto overflow-x-hidden py-2 flex flex-col px-2.5">
            {unpinnedDrawerItems.map((item) => {
              const isAnalytics = item.href === '/analytics';
              const showDot = isAnalytics && showWrappedTakeover;
              return (
                <NavLink
                  key={item.href}
                  to={item.href}
                  end={item.href === '/'}
                  className={({ isActive }) => cn(
                    "flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors hover:bg-secondary/50 min-h-[2.75rem] relative",
                    isActive ? "bg-primary/10 text-primary" : "text-muted-foreground"
                  )}
                  onClick={() => setMobileSidebarOpen(false)}
                >
                  <div className="relative">
                    <item.icon size={19} className="shrink-0" />
                    {showDot && (
                      <span className="absolute -top-1 -right-1 inline-flex rounded-full h-2 w-2 bg-rose-500" />
                    )}
                  </div>
                  <span className="min-w-0 break-words">{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
          <div className="p-2.5 border-t border-border/40">
            {showWrappedTakeover ? (
              <NavLink
                to="/analytics"
                className={({ isActive }) => cn(
                  "flex items-center gap-3 w-full rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-secondary/50 min-h-[2.75rem] relative border border-primary/20 bg-primary/5 text-primary",
                  isActive ? "bg-primary text-primary-foreground" : ""
                )}
                onClick={() => setMobileSidebarOpen(false)}
              >
                <Sparkles size={19} className="shrink-0 text-primary" />
                <span className="min-w-0 break-words font-semibold">
                  {isMonthlyWrapDay && !isWeeklyWrapDay ? 'Monthly wrap' : 'Weekly wrap'}
                </span>
                <span className="absolute top-2.5 right-3 inline-flex rounded-full h-2 w-2 bg-rose-500" />
              </NavLink>
            ) : (
              <NavLink
                to="/settings"
                className={({ isActive }) => cn(
                  "flex items-center gap-3 w-full rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-secondary/50 min-h-[2.75rem]",
                  isActive ? "bg-primary/10 text-primary" : "text-muted-foreground"
                )}
                onClick={() => setMobileSidebarOpen(false)}
              >
                <UserBlobatar identifier={user?.email || user?.id} size={24} />
                <div className="flex flex-col min-w-0 leading-tight">
                  <span className="min-w-0 truncate font-medium text-foreground text-sm">
                    {user?.email ? user.email.split('@')[0] : 'Settings'}
                  </span>
                  <span className="text-[11px] text-muted-foreground">Settings & Profile</span>
                </div>
              </NavLink>
            )}
          </div>
        </aside>
      </>
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col border-r border-separator bg-raised transition-[width] duration-200 ease-in-out select-none overflow-hidden motion-reduce:transition-none",
          isSidebarCollapsed ? "w-16" : "w-64"
        )}
      >
        <div className="flex h-14 items-center justify-between px-4">
          {!isSidebarCollapsed && (
            <span className="text-title font-semibold text-ink ps-2">LifeOS</span>
          )}
          <IconButton
            onClick={toggleSidebar}
            label={isSidebarCollapsed ? "Expand navigation" : "Collapse navigation"}
            className={cn(isSidebarCollapsed && "mx-auto")}
          >
            <Menu size={18} />
          </IconButton>
        </div>

        <div className="px-2 pb-2">
          <button
            data-tour="brain-dump"
            type="button"
            onClick={() => setIsBrainDumpOpen(true)}
            data-ds
            className={cn(
              "ds-t w-full flex items-center gap-3 rounded-control px-3 min-h-10 text-label font-medium",
              "bg-sunken text-ink hover:bg-hover",
              isSidebarCollapsed && "justify-center px-0 w-10 mx-auto"
            )}
            title="Brain dump (Alt+B)"
            aria-label={isSidebarCollapsed ? "Brain dump" : undefined}
          >
            <Brain size={18} className="shrink-0 text-ink-2" />
            {!isSidebarCollapsed && (
              <div className="flex items-center justify-between w-full min-w-0">
                <span className="truncate">Brain dump</span>
                <kbd className="text-caption text-ink-3">Alt+B</kbd>
              </div>
            )}
          </button>
        </div>

        <nav data-tour="sidebar-nav" className="flex-1 overflow-y-auto overflow-x-hidden py-2 gap-[2px] flex flex-col px-2">
          {desktopNavigation.map((item) => {
            const isAnalytics = item.href === '/analytics';
            const showDot = isAnalytics && showWrappedTakeover;
            return (
              <NavLink
                key={item.href}
                to={item.href}
                end={item.href === '/'}
                data-ds
                title={isSidebarCollapsed ? item.label : undefined}
                aria-label={isSidebarCollapsed ? item.label : undefined}
                className={({ isActive }) => cn(
                  "ds-t flex items-center gap-3 rounded-control px-3 min-h-10 text-label relative",
                  isActive
                    ? "bg-hover text-ink font-medium"
                    : "text-ink-2 hover:bg-hover hover:text-ink",
                  isSidebarCollapsed && "justify-center px-0 w-10 mx-auto"
                )}
              >
                {({ isActive }) => (
                  <>
                    <div className="relative flex items-center justify-center shrink-0">
                      <item.icon size={18} strokeWidth={isActive ? 2.2 : 1.8} />
                      {showDot && (
                        <span className="absolute -top-0.5 -end-0.5 h-2 w-2 rounded-pill bg-accent-ds" aria-hidden="true" />
                      )}
                    </div>
                    {!isSidebarCollapsed && <span>{item.label}</span>}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-2 border-t border-border/40 flex flex-col gap-[2px]">
          {showWrappedTakeover ? (
            <NavLink
              to="/analytics"
              data-ds
              title={isMonthlyWrapDay && !isWeeklyWrapDay ? 'Monthly wrap' : 'Weekly wrap'}
              className={({ isActive }) => cn(
                "ds-t flex items-center gap-3 w-full rounded-control px-3 min-h-10 text-label font-medium relative",
                isActive ? "bg-hover text-ink" : "text-ink hover:bg-hover",
                isSidebarCollapsed && "justify-center px-0 w-10 mx-auto"
              )}
            >
              {() => (
                <>
                  <div className="relative flex items-center justify-center shrink-0">
                    <Sparkles size={18} className="shrink-0 text-ink-2" />
                    <span className="absolute -top-0.5 -end-0.5 h-2 w-2 rounded-pill bg-accent-ds" aria-hidden="true" />
                  </div>
                  {!isSidebarCollapsed && (
                    <span>
                      {isMonthlyWrapDay && !isWeeklyWrapDay ? 'Monthly Wrap' : 'Weekly Wrap'}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ) : (
            <NavLink
              data-tour="settings-nav"
              to="/settings"
              data-ds
              aria-label={isSidebarCollapsed ? 'Settings' : undefined}
              className={({ isActive }) => cn(
                "ds-t flex items-center gap-3 w-full rounded-control px-3 min-h-11 text-label relative",
                isActive ? "bg-hover text-ink font-medium" : "text-ink-2 hover:bg-hover hover:text-ink",
                isSidebarCollapsed && "justify-center px-0 w-10 mx-auto"
              )}
              title={user?.email || 'Settings'}
            >
              {() => (
                <>
                  <UserBlobatar
                    identifier={user?.email || user?.id}
                    size={24}
                    unbordered
                    className="shrink-0"
                  />
                  {!isSidebarCollapsed && (
                    <div className="flex flex-col min-w-0 leading-tight">
                      <span className="font-medium text-label text-ink truncate">
                        {user?.email ? user.email.split('@')[0] : 'Settings'}
                      </span>
                      <span className="text-caption text-ink-3 truncate">
                        Settings
                      </span>
                    </div>
                  )}
                </>
              )}
            </NavLink>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Mobile Header: safe area top for iOS standalone (notch/status bar) */}
        <header
          className="md:hidden flex h-14 items-center justify-between border-b border-border/70 px-3.5 bg-background shrink-0 z-30"
          style={{ paddingTop: 'env(safe-area-inset-top)', minHeight: 'calc(3.5rem + env(safe-area-inset-top))' }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              data-tour="mobile-menu"
              onClick={() => setMobileSidebarOpen(true)}
              className="p-2 -ml-1 hover:bg-secondary/80 rounded-xl active:scale-95 transition-colors touch-manipulation text-foreground cursor-pointer"
              aria-label="Open menu"
            >
              <Menu size={22} />
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-bold text-base tracking-tight text-foreground truncate">
                {currentNavLabel}
              </span>
              {currentNavLabel !== 'LifeOS' && (
                <span className="text-caption px-1.5 py-0.5 rounded bg-muted text-muted-foreground hidden sm:inline-block">
                  LifeOS
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              data-tour="mobile-brain-dump"
              onClick={() => setIsBrainDumpOpen(true)}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary/80 rounded-xl active:scale-95 transition-colors touch-manipulation flex items-center justify-center cursor-pointer"
              title="Cognitive Brain Dump (Alt+B)"
            >
              <Brain size={19} />
            </button>
            <NavLink
              to="/settings"
              className="p-1 rounded-full active:scale-95 transition-transform touch-manipulation cursor-pointer flex items-center justify-center"
              title="Settings & Profile"
            >
              <UserBlobatar identifier={user?.email || user?.id} size={28} />
            </NavLink>
          </div>
        </header>

        <OfflineBanner />

        {/* Only this content area scrolls; header/sidebar/bottom bar are fixed */}
        <div
          className="flex-1 flex flex-col min-h-0 overflow-hidden relative"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <PullToRefresh>
          <div
            key={location.pathname}
            className={cn(
              "flex flex-col section-slide-in",
              location.pathname === '/chat'
                ? "h-full min-h-0 overflow-hidden p-0"
                : (isOnTasks || isOnNotes
                    ? "h-full min-h-0 overflow-hidden p-3.5 sm:p-4 md:p-6"
                    // overflow-x-hidden alone forces the UA to compute overflow-y as `auto`
                    // (per spec, an axis can't stay `visible` while the other isn't), which
                    // silently makes THIS div a scroll container/containing block for any
                    // `position: sticky` descendant (like the Settings page's jump-nav) even
                    // though it never actually scrolls, keeping sticky against the real
                    // scroll root two levels up (PullToRefresh's `data-lifeos-scroll-root`).
                    // overflow-y-visible keeps only the X axis clipped.
                    : "min-h-full overflow-x-hidden overflow-y-visible p-3.5 sm:p-4 md:p-6 pb-[calc(84px+env(safe-area-inset-bottom))] md:pb-6")
            )}
          >
            <Outlet />
          </div>
        </PullToRefresh>
        {showAppFooter && <AppFooter />}
        <FocusSessionManager />
        <FocusPiPWindow />
        <BrainDumpModal isOpen={isBrainDumpOpen} onClose={() => setIsBrainDumpOpen(false)} initialText={brainDumpInitialText} />
        <AIChatModal isOpen={isChatModalOpen} onClose={() => setIsChatModalOpen(false)} initialPrompt={chatModalPrompt} />
        <AppJoyrideTour />

        {/* Wrap Toast Notification */}
        {activeToast && (
          <div className="fixed bottom-[calc(100px+env(safe-area-inset-bottom))] md:bottom-6 right-4 left-4 md:left-auto md:w-96 z-[100] animate-in fade-in slide-in-from-bottom-5 duration-300">
            <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-4 shadow-xl flex gap-3.5 items-start">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0 relative">
                <Sparkles size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-sm text-foreground">
                  {activeToast === 'weekly' ? 'Weekly Wrapped is Ready!' : 'Monthly Wrapped is Ready!'}
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  {activeToast === 'weekly' 
                    ? 'Review your stats, trends, and achievements for the past week.' 
                    : 'See your comprehensive monthly insights and progress.'}
                </p>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => {
                      navigate('/analytics');
                      setActiveToast(null);
                    }}
                    className="px-3.5 py-1.5 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors rounded-lg cursor-pointer"
                  >
                    View Wrapped
                  </button>
                  <button
                    onClick={() => setActiveToast(null)}
                    className="px-3 py-1.5 text-xs font-semibold hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors rounded-lg cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
              <button
                onClick={() => setActiveToast(null)}
                className="p-1 hover:bg-secondary rounded-lg transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

        {/* Mobile Bottom Tab Bar */}
        {location.pathname !== '/chat' && location.pathname !== '/quran' && (
          <nav 
            data-tour="mobile-nav"
            className="md:hidden fixed bottom-0 left-0 right-0 border-t border-border/80 bg-background/90 backdrop-blur-2xl z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]"
            style={{
              paddingBottom: 'max(env(safe-area-inset-bottom), 6px)',
              height: 'calc(62px + env(safe-area-inset-bottom))'
            }}
          >
            <div className="flex justify-around items-center h-full px-1 max-w-lg mx-auto">
              {mobileNavigationMapped.map((item) => {
                const isAnalytics = item.href === '/analytics';
                const showDot = isAnalytics && showWrappedTakeover;
                return (
                  <MobileNavLink 
                    key={item.href} 
                    item={item} 
                    isMobileSidebarOpen={isMobileSidebarOpen}
                    setMobileSidebarOpen={setMobileSidebarOpen}
                    showDot={showDot}
                  />
                );
              })}
            </div>
          </nav>
        )}
      </main>
    </div>
  );
}
