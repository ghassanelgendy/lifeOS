import { Menu, X, Settings, Sparkles, Plus } from 'lucide-react';
import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { cn } from '../lib/utils';
import { NavLink, Outlet, useMatch, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CommandPalette } from './CommandPalette';
import { useUIStore } from '../stores/useUIStore';
import { PullToRefresh } from './PullToRefresh';
import { OfflineBanner } from './OfflineBanner';
import { FocusSessionManager } from './FocusSessionManager';
import { FocusPiPWindow } from './FocusPiPWindow';
import { NAV_ITEMS, type NavItem } from './navItems';
import { DEFAULT_DESKTOP_NAV } from '../stores/useUIStore';
import { checkWrapStatus } from '../lib/wrapHelpers';
import LiquidTabBar from './LiquidTabBar';

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

  const handleClick = (e: React.MouseEvent) => {
    if (isMobileSidebarOpen) {
      setMobileSidebarOpen(false);
      if (isActive && (item.href === '/dashboard' || item.href === '/')) {
        e.preventDefault();
      }
      return;
    }

    if (isActive) {
      if (item.href === '/dashboard' || item.href === '/') {
        e.preventDefault();
        setMobileSidebarOpen(true);
      }
    }
  };

  return (
    <NavLink
      to={item.href}
      end={item.href === '/'}
      onClick={handleClick}
      className={({ isActive: active }) => cn(
        "flex flex-col items-center justify-center w-full h-full active:scale-95 transition-all duration-100 relative transform-gpu",
        active ? "text-[#007AFF] dark:text-[#0A84FF] font-medium" : "text-[#8E8E93]"
      )}
    >
      <div className="relative">
        <Icon size={22} strokeWidth={isActive ? 2.4 : 2} />
        {showDot && (
          <span className="absolute -top-1 -right-1 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
          </span>
        )}
      </div>
      <span className="text-[10px] mt-0.5 tracking-tight font-medium">{item.label}</span>
    </NavLink>
  );
}

const SWIPE_EDGE_PX = 40;
const SWIPE_MIN_DELTA = 50;
const CENTER_SWIPE_MIN = 0.25;
const CENTER_SWIPE_MAX = 0.75;

export function AppShell() {
  const {
    isSidebarCollapsed,
    toggleSidebar,
    mobileNavItems,
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
  } = useUIStore();
  const location = useLocation();
  const navigate = useNavigate();
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const [showTabBar, setShowTabBar] = useState(true);
  const lastScrollTop = useRef(0);

  const { isWeeklyWrapDay, isMonthlyWrapDay, weeklyWrapKey, monthlyWrapKey } = checkWrapStatus();

  const showWrappedTakeover = useMemo(() => {
    const showWeekly = isWeeklyWrapDay && lastViewedWeeklyWrap !== weeklyWrapKey;
    const showMonthly = isMonthlyWrapDay && lastViewedMonthlyWrap !== monthlyWrapKey;
    return showWeekly || showMonthly;
  }, [isWeeklyWrapDay, isMonthlyWrapDay, lastViewedWeeklyWrap, lastViewedMonthlyWrap, weeklyWrapKey, monthlyWrapKey]);

  const mobileNavigationMapped = useMemo(() => {
    const rawItems = NAV_ITEMS.filter(item => item.href !== '/settings' && mobileNavItems.includes(item.href));
    return rawItems;
  }, [mobileNavItems]);

  const desktopNavigation = useMemo(() => {
    const navItems = NAV_ITEMS.filter((item) => item.href !== '/settings');
    const fallback = [...DEFAULT_DESKTOP_NAV];
    const savedOrder = (desktopNavOrder.length ? desktopNavOrder : fallback)
      .map((href) => navItems.find((item) => item.href === href))
      .filter((item): item is NavItem => !!item);
    const missing = navItems.filter((item) => !savedOrder.some((saved) => saved.href === item.href));
    return [...savedOrder, ...missing].filter((item) => desktopNavVisible[item.href] !== false);
  }, [desktopNavOrder, desktopNavVisible]);

  const currentIndex = mobileNavigationMapped.findIndex(
    (item) => item.href === '/' ? location.pathname === '/' : location.pathname === item.href || location.pathname.startsWith(item.href + '/')
  );
  const isOnTasks = location.pathname === '/tasks';
  const showHeaderPlusButton = location.pathname === '/tasks' || location.pathname === '/habits' || location.pathname === '/finance' || location.pathname === '/calendar';

  const handleHeaderPlusClick = useCallback(() => {
    if (location.pathname === '/tasks') {
      window.dispatchEvent(new CustomEvent('app-trigger-add-task'));
    } else if (location.pathname === '/habits') {
      window.dispatchEvent(new CustomEvent('app-trigger-add-habit'));
    } else if (location.pathname === '/finance') {
      window.dispatchEvent(new CustomEvent('app-trigger-add-finance'));
    } else if (location.pathname === '/calendar') {
      window.dispatchEvent(new CustomEvent('app-trigger-add-calendar'));
    }
  }, [location.pathname]);

  const getActiveTitle = useCallback(() => {
    if (location.pathname === '/' || location.pathname === '/dashboard') {
      return 'Dashboard';
    }
    const item = NAV_ITEMS.find(
      (n) => n.href !== '/' && (location.pathname === n.href || location.pathname.startsWith(n.href + '/'))
    );
    return item ? item.label : 'lifeOS';
  }, [location.pathname]);

  const prevPathRef = useRef<string>(location.pathname);
  const prevIndexRef = useRef<number>(currentIndex);
  const [slideDirection, setSlideDirection] = useState<number>(0);

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

  useEffect(() => {
    if (prevPathRef.current === location.pathname) return;
    const prevIndex = prevIndexRef.current;
    const dir = prevIndex >= 0 ? Math.sign(currentIndex - prevIndex) : 0;
    prevPathRef.current = location.pathname;
    prevIndexRef.current = currentIndex;
    setSlideDirection(dir);
  }, [location.pathname, currentIndex]);

  useEffect(() => {
    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement;
      if (!target || typeof target.hasAttribute !== 'function' || !target.hasAttribute('data-lifeos-scroll-root')) {
        return;
      }

      const scrollTop = target.scrollTop;
      
      // Always show full size at the top of the page
      if (scrollTop <= 10) {
        setShowTabBar(true);
        lastScrollTop.current = scrollTop;
        return;
      }

      const diff = scrollTop - lastScrollTop.current;

      // React quickly (6px threshold) to scrolling direction changes
      if (Math.abs(diff) > 6) {
        if (diff > 0) {
          setShowTabBar(false); // Scroll down -> shrink
        } else {
          setShowTabBar(true);  // Scroll up -> expand
        }
        lastScrollTop.current = scrollTop;
      }
    };

    document.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener('scroll', handleScroll, { capture: true });
    };
  }, []);

  // Automatically restore tab bar to full size on route changes
  useEffect(() => {
    setShowTabBar(true);
  }, [location.pathname]);

  const gestureContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = gestureContainerRef.current;
    if (!container) return;

    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      touchStart.current = { x: t.clientX, y: t.clientY };
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!touchStart.current) return;
      const t = e.touches[0];
      const deltaX = t.clientX - touchStart.current.x;
      const deltaY = t.clientY - touchStart.current.y;

      const isFromLeftEdge = touchStart.current.x < SWIPE_EDGE_PX;
      const isHorizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY);

      // Lock vertical scrolling only if touch originates from left edge (sidebar swipe)
      if (isFromLeftEdge && isHorizontalSwipe && Math.abs(deltaX) > 5) {
        if (e.cancelable) {
          e.preventDefault();
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!touchStart.current) return;
      const t = e.changedTouches[0];
      const deltaX = t.clientX - touchStart.current.x;

      if (touchStart.current.x < SWIPE_EDGE_PX && deltaX > 30) {
        setMobileSidebarOpen(true);
      }
      touchStart.current = null;
    };

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
    };
  }, [isOnTasks, currentIndex, mobileNavigationMapped, navigate, setMobileSidebarOpen]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground font-sans">
      <CommandPalette />
      {/* Mobile drawer (slide from left) */}
      <>
        <div
          className={cn(
            "md:hidden fixed inset-0 z-40 bg-black/50 transition-opacity duration-150",
            isMobileSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden
        />
        <aside
          className={cn(
            "md:hidden fixed z-50 w-[min(20rem,85vw)] min-w-[16rem] flex flex-col transition-transform duration-250 ease-out will-change-transform transform-gpu rounded-[24px]",
            "bg-[#F9F9F9]/85 dark:bg-[#1C1C1E]/85 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-2xl",
            isMobileSidebarOpen ? "translate-x-0" : "-translate-x-[calc(100%+24px)]"
          )}
          style={{ 
            top: 'calc(12px + env(safe-area-inset-top))', 
            left: '12px',
            height: 'calc(100dvh - 24px - env(safe-area-inset-top) - env(safe-area-inset-bottom))'
          }}
        >
          <div className="flex h-14 items-center justify-between px-5 border-b border-border/40 shrink-0">
            <span className="text-lg font-bold tracking-tight">LifeOS</span>
            <button 
              onClick={() => setMobileSidebarOpen(false)} 
              className="p-1.5 hover:bg-secondary/60 rounded-full active:scale-95 transition-transform touch-manipulation text-muted-foreground"
            >
              <X size={20} />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 flex flex-col gap-0.5 px-3">
            {desktopNavigation.map((item) => {
              const isAnalytics = item.href === '/analytics';
              const showDot = isAnalytics && showWrappedTakeover;
              return (
                <NavLink
                  key={item.href}
                  to={item.href}
                  end={item.href === '/'}
                  className={({ isActive }) => cn(
                    "flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-base font-medium transition-colors hover:bg-secondary/50 min-h-[3rem] relative",
                    isActive ? "bg-primary/10 text-primary" : "text-muted-foreground"
                  )}
                  onClick={() => setMobileSidebarOpen(false)}
                >
                  <div className="relative">
                    <item.icon size={22} className="shrink-0" />
                    {showDot && (
                      <span className="absolute -top-1 -right-1 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                      </span>
                    )}
                  </div>
                  <span className="min-w-0 break-words">{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
          <div className="p-3 border-t border-border/40">
            {showWrappedTakeover ? (
              <NavLink
                to="/analytics"
                className={({ isActive }) => cn(
                  "flex items-center gap-3.5 w-full rounded-xl px-4 py-2.5 text-base font-medium hover:bg-secondary/50 min-h-[3rem] relative border border-primary/20 bg-primary/5 text-primary",
                  isActive ? "bg-primary text-primary-foreground" : ""
                )}
                onClick={() => setMobileSidebarOpen(false)}
              >
                <Sparkles size={22} className="shrink-0 text-primary animate-pulse" />
                <span className="min-w-0 break-words font-semibold">
                  {isMonthlyWrapDay && !isWeeklyWrapDay ? 'Monthly Wrap' : 'Weekly Wrap'}
                </span>
                <span className="absolute top-2.5 right-3 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                </span>
              </NavLink>
            ) : (
              <NavLink
                to="/settings"
                className={({ isActive }) => cn(
                  "flex items-center gap-3.5 w-full rounded-xl px-4 py-2.5 text-base font-medium hover:bg-secondary/50 min-h-[3rem]",
                  isActive ? "bg-primary/10 text-primary" : "text-muted-foreground"
                )}
                onClick={() => setMobileSidebarOpen(false)}
              >
                <Settings size={22} className="shrink-0" />
                <span className="min-w-0 break-words">Settings</span>
              </NavLink>
            )}
          </div>
        </aside>
      </>
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col border-r border-white/10 bg-[#f9f9f9]/40 dark:bg-[#1c1c1e]/60 backdrop-blur-xl transition-all duration-300 ease-in-out",
          isSidebarCollapsed ? "w-16" : "w-64"
        )}
      >
        <div className="flex h-14 items-center justify-between px-4 border-b border-white/10">
          {!isSidebarCollapsed && <span className="text-xl font-bold tracking-tight">LifeOS</span>}
          <button
            onClick={toggleSidebar}
            className="p-1 hover:bg-secondary rounded-md transition-colors"
          >
            {isSidebarCollapsed ? <Menu size={20} /> : <X size={20} />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 gap-1 flex flex-col px-2">
          {desktopNavigation.map((item) => {
            const isAnalytics = item.href === '/analytics';
            const showDot = isAnalytics && showWrappedTakeover;
            return (
              <NavLink
                key={item.href}
                to={item.href}
                end={item.href === '/'}
                className={({ isActive }) => cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-secondary hover:text-foreground relative",
                  isActive ? "bg-secondary text-foreground" : "text-muted-foreground",
                  isSidebarCollapsed && "justify-center px-2"
                )}
              >
                <div className="relative">
                  <item.icon size={20} />
                  {showDot && (
                    <span className="absolute -top-1 -right-1 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                    </span>
                  )}
                </div>
                {!isSidebarCollapsed && <span>{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10">
          {showWrappedTakeover ? (
            <NavLink
              to="/analytics"
              className={({ isActive }) => cn(
                "flex items-center gap-3 w-full rounded-lg px-3 py-2 text-sm font-medium hover:bg-secondary transition-colors relative border border-primary/20 bg-primary/5 text-primary",
                isActive ? "bg-primary text-primary-foreground" : "",
                isSidebarCollapsed && "justify-center px-2"
              )}
            >
              <Sparkles size={28} className="shrink-0 text-primary animate-pulse" />
              {!isSidebarCollapsed && (
                <span className="font-semibold text-primary">
                  {isMonthlyWrapDay && !isWeeklyWrapDay ? 'Monthly Wrap' : 'Weekly Wrap'}
                </span>
              )}
              <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
              </span>
            </NavLink>
          ) : (
            <NavLink
              to="/settings"
              className={({ isActive }) => cn(
                "flex items-center gap-3 w-full rounded-lg px-3 py-2 text-sm font-medium hover:bg-secondary transition-colors",
                isActive ? "bg-secondary text-foreground" : "text-muted-foreground",
                isSidebarCollapsed && "justify-center px-2"
              )}
            >
              <Settings size={28} />
              {!isSidebarCollapsed && <span>Settings</span>}
            </NavLink>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Mobile Header — safe area top for iOS standalone (notch/status bar) */}
        <header
          className="md:hidden flex items-center justify-center border-b border-border/40 px-4 bg-[#F9F9F9]/85 dark:bg-[#1C1C1E]/85 backdrop-blur-lg shrink-0 relative"
          style={{ 
            paddingTop: 'env(safe-area-inset-top)', 
            height: 'calc(3.5rem + env(safe-area-inset-top))' 
          }}
        >
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="absolute left-3 p-1.5 hover:bg-secondary/60 rounded-full active:scale-95 transition-transform touch-manipulation text-muted-foreground"
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>
          
          {/* Pro-Tip: Native logo subtle fade-in on load or route changes */}
          <motion.span
            key={location.pathname}
            initial={{ opacity: 0, y: -2 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="font-bold text-base tracking-tight select-none font-sans"
          >
            {getActiveTitle()}
          </motion.span>

          {showHeaderPlusButton && (
            <button
              onClick={handleHeaderPlusClick}
              className="absolute right-3 w-9 h-9 flex items-center justify-center rounded-full bg-primary/10 border border-primary/25 backdrop-blur-md shadow-sm active:scale-90 active:bg-primary/20 transition-all touch-manipulation"
              aria-label="Add"
            >
              <Plus size={20} className="text-primary" />
            </button>
          )}
        </header>

        <OfflineBanner />

        {/* Only this content area scrolls; header/sidebar/bottom bar are fixed */}
        <div
          ref={gestureContainerRef}
          className="flex-1 flex flex-col min-h-0 overflow-hidden relative"
        >
          <PullToRefresh>
            <div className="relative w-full h-full overflow-hidden flex flex-col">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div
                  key={location.pathname}
                  initial={{ x: slideDirection * 60, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -slideDirection * 60, opacity: 0 }}
                  transition={{
                    type: "spring",
                    stiffness: 380,
                    damping: 32,
                    mass: 0.9
                  }}
                  className={cn(
                    "flex flex-col p-4 md:p-6 w-full",
                    "pb-[calc(76px+env(safe-area-inset-bottom))] md:pb-6",
                    isOnTasks ? "h-full min-h-0 overflow-hidden" : "min-h-full overflow-x-hidden"
                  )}
                  style={{
                    backfaceVisibility: 'hidden',
                    WebkitFontSmoothing: 'subpixel-antialiased',
                  }}
                >
                  <Outlet />
                </motion.div>
              </AnimatePresence>
            </div>
          </PullToRefresh>
          <FocusSessionManager />
          <FocusPiPWindow />

        {/* Wrap Toast Notification */}
        {activeToast && (
          <div className="fixed bottom-[calc(76px+env(safe-area-inset-bottom))] md:bottom-6 right-4 left-4 md:left-auto md:w-96 z-[100] animate-in fade-in slide-in-from-bottom-5 duration-300">
            <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-card/90 backdrop-blur-xl p-4 shadow-2xl flex gap-3.5 items-start">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-accent/5 to-transparent pointer-events-none" />
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0 relative">
                <Sparkles size={20} className="animate-pulse" />
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
                    className="px-3.5 py-1.5 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors rounded-lg shadow-sm cursor-pointer"
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
        <LiquidTabBar
          tabs={mobileNavigationMapped}
          activeTabHref={location.pathname}
          onTabClick={(href) => {
            setShowTabBar(true);
            if (location.pathname === href) {
              const scrollRoot = document.querySelector('[data-lifeos-scroll-root]');
              if (scrollRoot) {
                scrollRoot.scrollTo({ top: 0, behavior: 'smooth' });
              }
            } else {
              navigate(href);
            }
          }}
          showDotForHref={(href) => href === '/analytics' && showWrappedTakeover}
          isVisible={showTabBar}
        />
        {/* Global SVG Displacement Filter for iOS Liquid Glass cards */}
        <svg style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }} xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="liquid-glass-refraction">
              <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="1" result="noise" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="5" xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </defs>
        </svg>
      </main>
    </div>
  );
}
