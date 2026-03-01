import {
  LayoutDashboard,
  Dumbbell,
  GraduationCap,
  Calendar,
  Menu,
  X,
  Settings,
  Wallet,
  Target,
  CheckSquare,
  Monitor,
  Moon,
  Focus as FocusIcon
} from 'lucide-react';
import { useRef, useCallback, useMemo } from 'react';
import { cn } from '../lib/utils';
import { NavLink, Outlet, useMatch, useLocation, useNavigate } from 'react-router-dom';
import { CommandPalette } from './CommandPalette';
import { useUIStore } from '../stores/useUIStore';
import { PullToRefresh } from './PullToRefresh';
import { OfflineBanner } from './OfflineBanner';
import { AppFooter } from './AppFooter';
import { FocusSessionManager } from './FocusSessionManager';
import { FocusPiPWindow } from './FocusPiPWindow';

export interface NavItem {
  label: string;
  icon: React.ElementType;
  href: string;
}

// All navigation items (exported for use in Settings)
export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/' },
  { label: 'Tasks', icon: CheckSquare, href: '/tasks' },
  { label: 'Focus', icon: FocusIcon, href: '/focus' },
  { label: 'Habits', icon: Target, href: '/habits' },
  { label: 'Calendar', icon: Calendar, href: '/calendar' },
  { label: 'Bio-Metrics', icon: Dumbbell, href: '/health' },
  { label: 'Screen Time', icon: Monitor, href: '/screentime' },
  { label: 'Sleep', icon: Moon, href: '/sleep' },
  { label: 'Academic', icon: GraduationCap, href: '/academics' },
  { label: 'Finance', icon: Wallet, href: '/finance' },
  { label: 'Settings', icon: Settings, href: '/settings' },
];

function MobileNavLink({ item }: { item: NavItem }) {
  const match = useMatch({ path: item.href, end: item.href === '/' });
  const isActive = !!match;
  const Icon = item.icon;
  return (
    <NavLink
      to={item.href}
      end={item.href === '/'}
      className={({ isActive: active }) => cn(
        "flex flex-col items-center justify-center w-full h-full active:opacity-70 transition-all duration-150",
        active ? "text-foreground" : "text-muted-foreground"
      )}
    >
      <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
      <span className="text-[11px] mt-0.5 font-medium">{item.label}</span>
    </NavLink>
  );
}

const SWIPE_EDGE_PX = 24;
const SWIPE_MIN_DELTA = 50;
const CENTER_SWIPE_MIN = 0.25;
const CENTER_SWIPE_MAX = 0.75;

export function AppShell() {
  const { isSidebarCollapsed, toggleSidebar, mobileNavItems, isMobileSidebarOpen, setMobileSidebarOpen } = useUIStore();
  const location = useLocation();
  const navigate = useNavigate();
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const mobileNavigation = NAV_ITEMS.filter(item => mobileNavItems.includes(item.href));
  const currentIndex = mobileNavigation.findIndex(
    (item) => item.href === '/' ? location.pathname === '/' : location.pathname === item.href || location.pathname.startsWith(item.href + '/')
  );
  const isOnTasks = location.pathname === '/tasks';

  const prevPathRef = useRef<string>(location.pathname);
  const prevIndexRef = useRef<number>(currentIndex);
  const directionRef = useRef<number>(0);
  const slideDirection = useMemo(() => {
    if (prevPathRef.current !== location.pathname) {
      const dir = prevIndexRef.current >= 0 ? Math.sign(currentIndex - prevIndexRef.current) : 0;
      prevPathRef.current = location.pathname;
      prevIndexRef.current = currentIndex;
      directionRef.current = dir;
      return dir;
    }
    return directionRef.current;
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

    // Swipe from left edge on Tasks → open mobile sidebar
    if (isOnTasks && touchStart.current.x < SWIPE_EDGE_PX && deltaX > SWIPE_MIN_DELTA) {
      setMobileSidebarOpen(true);
      touchStart.current = null;
      return;
    }

    // On Tasks page, disable horizontal tab navigation so task swipe actions work smoothly
    if (isOnTasks) {
      touchStart.current = null;
      return;
    }

    // Swipe from center → navigate tabs (only if mostly horizontal)
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
      navigate(mobileNavigation[currentIndex - 1].href);
    } else if (deltaX < -SWIPE_MIN_DELTA && currentIndex >= 0 && currentIndex < mobileNavigation.length - 1) {
      navigate(mobileNavigation[currentIndex + 1].href);
    }
    touchStart.current = null;
  }, [isOnTasks, currentIndex, mobileNavigation, navigate, setMobileSidebarOpen]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground font-sans">
      <CommandPalette />
      {/* Mobile drawer (slide from left) */}
      <>
        <div
          className={cn(
            "md:hidden fixed inset-0 z-40 bg-black/50 transition-opacity duration-300",
            isMobileSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden
        />
        <aside
          className={cn(
            "md:hidden fixed top-0 left-0 z-50 w-[min(22rem,94vw)] min-w-[18rem] h-full flex flex-col bg-card border-r border-border shadow-xl transition-transform duration-300 ease-out",
            isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <div className="flex h-14 items-center justify-between px-4 border-b border-border shrink-0">
            <span className="text-xl font-bold tracking-tight">LifeOS</span>
            <button onClick={() => setMobileSidebarOpen(false)} className="p-1 hover:bg-secondary rounded-md touch-manipulation">
              <X size={24} />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 flex flex-col gap-0.5 px-3">
            {NAV_ITEMS.filter(item => item.href !== '/settings').map((item) => (
              <NavLink
                key={item.href}
                to={item.href}
                end={item.href === '/'}
                className={({ isActive }) => cn(
                  "flex items-center gap-4 rounded-xl px-4 py-3.5 text-lg font-medium transition-colors hover:bg-secondary min-h-[3.25rem]",
                  isActive ? "bg-secondary text-foreground" : "text-muted-foreground"
                )}
                onClick={() => setMobileSidebarOpen(false)}
              >
                <item.icon size={26} className="shrink-0" />
                <span className="min-w-0 break-words">{item.label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="p-4 border-t border-border">
            <NavLink
              to="/settings"
              className={({ isActive }) => cn(
                "flex items-center gap-4 w-full rounded-xl px-4 py-3.5 text-lg font-medium hover:bg-secondary min-h-[3.25rem]",
                isActive ? "bg-secondary text-foreground" : "text-muted-foreground"
              )}
              onClick={() => setMobileSidebarOpen(false)}
            >
              <Settings size={26} className="shrink-0" />
              <span className="min-w-0 break-words">Settings</span>
            </NavLink>
          </div>
        </aside>
      </>
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col border-r border-border bg-card transition-all duration-300 ease-in-out",
          isSidebarCollapsed ? "w-16" : "w-64"
        )}
      >
        <div className="flex h-14 items-center justify-between px-4 border-b border-border">
          {!isSidebarCollapsed && <span className="text-xl font-bold tracking-tight">LifeOS</span>}
          <button
            onClick={toggleSidebar}
            className="p-1 hover:bg-secondary rounded-md transition-colors"
          >
            {isSidebarCollapsed ? <Menu size={20} /> : <X size={20} />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 gap-1 flex flex-col px-2">
          {NAV_ITEMS.filter(item => item.href !== '/settings').map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              end={item.href === '/'}
              className={({ isActive }) => cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-secondary hover:text-foreground",
                isActive ? "bg-secondary text-foreground" : "text-muted-foreground",
                isSidebarCollapsed && "justify-center px-2"
              )}
            >
              <item.icon size={20} />
              {!isSidebarCollapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-border">
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
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Mobile Header — safe area top for iOS standalone (notch/status bar) */}
        <header
          className="md:hidden flex h-14 items-center justify-between border-b border-border px-4 bg-background shrink-0"
          style={{ paddingTop: 'env(safe-area-inset-top)', minHeight: 'calc(3.5rem + env(safe-area-inset-top))' }}
        >
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="p-2 -ml-2 hover:bg-secondary rounded-lg touch-manipulation"
            aria-label="Open menu"
          >
            <Menu size={24} />
          </button>
          <span className="font-bold text-lg">LifeOS</span>
          <div className="w-10" />
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
              "flex flex-col p-4 md:p-6 section-slide-in",
              "pb-[calc(64px+env(safe-area-inset-bottom))] md:pb-6",
              isOnTasks ? "h-full min-h-0 overflow-hidden" : "min-h-full"
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

        {/* Mobile Bottom Tab Bar */}
        <nav 
          className="md:hidden fixed bottom-0 left-0 right-0 border-t border-border bg-background/95 backdrop-blur-xl z-50"
          style={{
            paddingBottom: 'max(env(safe-area-inset-bottom), 0px)',
            height: 'calc(64px + env(safe-area-inset-bottom))'
          }}
        >
          <div className="flex justify-around items-center h-16">
            {mobileNavigation.map((item) => (
              <MobileNavLink key={item.href} item={item} />
            ))}
          </div>
        </nav>
      </main>
    </div>
  );
}
