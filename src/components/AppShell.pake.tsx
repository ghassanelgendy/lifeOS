import { Menu, X, Settings, Sparkles } from 'lucide-react';
import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { cn } from '../lib/utils';
import { NavLink, Outlet, useMatch, useLocation, useNavigate } from 'react-router-dom';
import { CommandPalette } from './CommandPalette';
import { useUIStore } from '../stores/useUIStore';
import { PullToRefresh } from './PullToRefresh';
import { OfflineBanner } from './OfflineBanner';
import { AppFooter } from './AppFooter';
import { FocusSessionManager } from './FocusSessionManager';
import { FocusPiPWindow } from './FocusPiPWindow';
import { NAV_ITEMS, type NavItem } from './navItems';
import { DEFAULT_DESKTOP_NAV } from '../stores/useUIStore';
import { checkWrapStatus } from '../lib/wrapHelpers';

// Fluent UI React Components
import {
  FluentProvider,
  webDarkTheme,
  webLightTheme,
  Text,
  type Theme
} from '@fluentui/react-components';

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
        "flex flex-col items-center justify-center w-full h-full active:opacity-70 transition-all duration-150 relative",
        active ? "text-foreground" : "text-muted-foreground"
      )}
    >
      <div className="relative">
        <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
        {showDot && (
          <span className="absolute -top-1 -right-1 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
          </span>
        )}
      </div>
      <span className="text-[11px] mt-0.5 font-medium">{item.label}</span>
    </NavLink>
  );
}

const SWIPE_EDGE_PX = 24;
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
    aiEnabled,
  } = useUIStore();
  const location = useLocation();
  const navigate = useNavigate();
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const { isWeeklyWrapDay, isMonthlyWrapDay, weeklyWrapKey, monthlyWrapKey } = checkWrapStatus();

  const [theme, setTheme] = useState<Theme>(webDarkTheme);

  useEffect(() => {
    const checkTheme = () => {
      const isDark = document.documentElement.classList.contains('dark');
      const baseTheme = isDark ? webDarkTheme : webLightTheme;
      setTheme({
        ...baseTheme,
        // Match the background surfaces precisely
        colorNeutralBackground1: isDark ? '#121214' : '#f8f9fa', 
        colorNeutralBackground3: isDark ? '#1a1a1e' : '#ffffff', 
        
        // Match border colors and styling
        colorNeutralStroke1: isDark ? '#3a3a3f' : '#d1d1d6', 
        colorNeutralStroke2: isDark ? '#2e2e33' : '#e5e5ea', 

        // Match text styles
        colorNeutralForeground1: isDark ? '#ffffff' : '#000000', 
        colorNeutralForeground2: isDark ? '#e0e0e0' : '#2f2f2f', 
        colorNeutralForeground3: isDark ? '#b3b3b3' : '#595959', 
      });
    };
    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

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

  const desktopNavigation = useMemo(() => {
    const navItems = NAV_ITEMS.filter((item) => item.href !== '/settings' && (aiEnabled || item.href !== '/chat'));
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

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const t = e.touches[0];
    const deltaX = t.clientX - touchStart.current.x;
    const deltaY = t.clientY - touchStart.current.y;
    const horizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 15;
    const fromLeftEdge = touchStart.current.x < SWIPE_EDGE_PX;
    if (horizontalSwipe && fromLeftEdge) {
      e.preventDefault();
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const t = e.changedTouches[0];
    const deltaX = t.clientX - touchStart.current.x;
    const deltaY = t.clientY - touchStart.current.y;
    const w = window.innerWidth;

    if (touchStart.current.x < SWIPE_EDGE_PX && deltaX > 30) {
      setMobileSidebarOpen(true);
      touchStart.current = null;
      return;
    }

    if (isOnTasks) {
      touchStart.current = null;
      return;
    }

    if (Math.abs(deltaX) < Math.abs(deltaY) || Math.abs(deltaX) < SWIPE_MIN_DELTA) {
      touchStart.current = null;
      return;
    }
    const startRatio = touchStart.current.x / w;
    if (startRatio < CENTER_SWIPE_MIN || startRatio > CENTER_SWIPE_MAX) {
      touchStart.current = null;
      return;
    }
    if (deltaX > SWIPE_MIN_DELTA && currentIndex > 0) {
      navigate(mobileNavigationMapped[currentIndex - 1].href);
    } else if (deltaX < -SWIPE_MIN_DELTA && currentIndex >= 0 && currentIndex < mobileNavigationMapped.length - 1) {
      navigate(mobileNavigationMapped[currentIndex + 1].href);
    }
    touchStart.current = null;
  }, [isOnTasks, currentIndex, mobileNavigationMapped, navigate, setMobileSidebarOpen]);

  return (
    <FluentProvider theme={theme} className="w-full h-screen">
      <div
        className="flex h-screen w-full overflow-hidden text-foreground font-sans"
        style={{
          backgroundColor: 'var(--colorNeutralBackground1)',
        }}
      >
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
              "md:hidden fixed top-0 left-0 z-50 w-[min(22rem,94vw)] min-w-[18rem] h-full flex flex-col border-r shadow-xl transition-transform duration-150 ease-out will-change-transform transform-gpu",
              isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
            )}
            style={{
              paddingTop: 'env(safe-area-inset-top)',
              backgroundColor: 'var(--colorNeutralBackground3)',
              borderColor: 'var(--colorNeutralStroke1)',
            }}
          >
            <div className="flex h-14 items-center justify-between px-4 border-b shrink-0" style={{ borderColor: 'var(--colorNeutralStroke2)' }}>
              <span className="text-xl font-bold tracking-tight">LifeOS</span>
              <button 
                onClick={() => setMobileSidebarOpen(false)} 
                className="p-1 hover:bg-secondary rounded-md active:scale-95 transition-transform touch-manipulation text-foreground"
              >
                <X size={24} />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 flex flex-col gap-0.5 px-3">
              {desktopNavigation.map((item) => {
                const isAnalytics = item.href === '/analytics';
                const showDot = isAnalytics && showWrappedTakeover;
                return (
                  <NavLink
                    key={item.href}
                    to={item.href}
                    end={item.href === '/'}
                    className={({ isActive }) => cn(
                      "flex items-center gap-4 rounded-xl px-4 py-3.5 text-lg font-medium transition-colors hover:bg-neutral-hover/10 min-h-[3.25rem] relative",
                      isActive ? "bg-neutral-hover/5 text-foreground" : "text-muted-foreground"
                    )}
                    onClick={() => setMobileSidebarOpen(false)}
                  >
                    <div className="relative">
                      <item.icon size={26} className="shrink-0 text-foreground" />
                      {showDot && (
                        <span className="absolute -top-1 -right-1 flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                        </span>
                      )}
                    </div>
                    <span className="min-w-0 break-words text-foreground">{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
          </aside>
        </>
        {/* Desktop Sidebar */}
        <aside
          className={cn(
            "hidden md:flex flex-col border-r transition-all duration-300 ease-in-out select-none overflow-hidden",
            isSidebarCollapsed ? "w-16" : "w-64"
          )}
          style={{
            backgroundColor: 'var(--colorNeutralBackground3)',
            borderColor: 'var(--colorNeutralStroke1)',
          }}
        >
          <div className="flex h-14 items-center justify-between px-4">
            {!isSidebarCollapsed && (
              <span className="text-sm font-bold tracking-wide text-muted-foreground uppercase pl-2">
                LifeOS
              </span>
            )}
            <button
              onClick={toggleSidebar}
              className={cn(
                "p-2 hover:bg-white/10 rounded-md transition-colors text-foreground",
                isSidebarCollapsed && "mx-auto"
              )}
              title={isSidebarCollapsed ? "Expand navigation" : "Collapse navigation"}
            >
              <Menu size={16} />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2 gap-[2px] flex flex-col px-2">
            {desktopNavigation.map((item) => {
              const isAnalytics = item.href === '/analytics';
              const showDot = isAnalytics && showWrappedTakeover;
              return (
                <NavLink
                  key={item.href}
                  to={item.href}
                  end={item.href === '/'}
                  className={({ isActive }) => cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-[13px] font-normal transition-all duration-150 relative",
                    "hover:bg-white/10 hover:text-foreground",
                    isActive 
                      ? "bg-white/[0.08] text-foreground font-semibold" 
                      : "text-muted-foreground",
                    isSidebarCollapsed && "justify-center px-0 w-12 h-9 mx-auto"
                  )}
                >
                  {({ isActive }) => (
                    <>
                      {/* Fluent UI active indicator */}
                      {isActive && (
                        <div className="absolute left-0 top-[20%] bottom-[20%] w-[3px] rounded-full bg-brand-primary" />
                      )}
                      <div className="relative flex items-center justify-center shrink-0">
                        <item.icon size={16} strokeWidth={isActive ? 2.2 : 1.8} className="text-foreground" />
                        {showDot && (
                          <span className="absolute -top-1 -right-1 flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                          </span>
                        )}
                      </div>
                      {!isSidebarCollapsed && <span className="text-foreground">{item.label}</span>}
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>

          <div className="p-2 border-t flex flex-col gap-[2px]" style={{ borderColor: 'var(--colorNeutralStroke2)' }}>
            <NavLink
              to="/settings"
              className={({ isActive }) => cn(
                "flex items-center gap-3 w-full rounded-md px-3 py-2 text-[13px] font-normal transition-all duration-150 relative",
                "hover:bg-white/10 hover:text-foreground",
                isActive 
                  ? "bg-white/[0.08] text-foreground font-semibold" 
                  : "text-muted-foreground",
                isSidebarCollapsed && "justify-center px-0 w-12 h-9 mx-auto"
              )}
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <div className="absolute left-0 top-[20%] bottom-[20%] w-[3px] rounded-full bg-brand-primary" />
                  )}
                  <div className="relative flex items-center justify-center shrink-0">
                    <Settings size={16} strokeWidth={isActive ? 2.2 : 1.8} className="text-foreground" />
                  </div>
                  {!isSidebarCollapsed && <span className="text-foreground">Settings</span>}
                </>
              )}
            </NavLink>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col h-full overflow-hidden bg-transparent">
          <OfflineBanner />

          {/* Only this content area scrolls; header/sidebar/bottom bar are fixed */}
          <div
            className="flex-1 flex flex-col min-h-0 overflow-hidden relative bg-transparent"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <PullToRefresh>
              <div
                key={location.pathname}
                className={cn(
                  "flex flex-col p-4 md:p-6 section-slide-in bg-transparent",
                  "pb-[calc(64px+env(safe-area-inset-bottom))] md:pb-6",
                  isOnTasks ? "h-full min-h-0 overflow-hidden" : "min-h-full overflow-x-hidden"
                )}
                style={
                  {
                    '--section-dx': slideDirection === 1 ? '25%' : slideDirection === -1 ? '-25%' : '0',
                  } as React.CSSProperties
                }
              >
                <Outlet />
              </div>
            </PullToRefresh>
            <AppFooter />
            <FocusSessionManager />
            <FocusPiPWindow />
          </div>
        </main>
      </div>
    </FluentProvider>
  );
}
