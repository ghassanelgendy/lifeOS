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
  CheckSquare
} from 'lucide-react';
import { cn } from '../lib/utils';
import { NavLink, Outlet } from 'react-router-dom';
import { CommandPalette } from './CommandPalette';
import { useUIStore } from '../stores/useUIStore';
import { PullToRefresh } from './PullToRefresh';

export interface NavItem {
  label: string;
  icon: React.ElementType;
  href: string;
}

// All navigation items (exported for use in Settings)
export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/' },
  { label: 'Tasks', icon: CheckSquare, href: '/tasks' },
  { label: 'Habits', icon: Target, href: '/habits' },
  { label: 'Calendar', icon: Calendar, href: '/calendar' },
  { label: 'Bio-Metrics', icon: Dumbbell, href: '/health' },
  { label: 'Academic', icon: GraduationCap, href: '/academics' },
  { label: 'Finance', icon: Wallet, href: '/finance' },
  { label: 'Settings', icon: Settings, href: '/settings' },
];

export function AppShell() {
  const { isSidebarCollapsed, toggleSidebar, mobileNavItems } = useUIStore();

  // Filter NAV_ITEMS based on user's mobile nav selection
  const mobileNavigation = NAV_ITEMS.filter(item => mobileNavItems.includes(item.href));

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground font-sans">
      <CommandPalette />
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
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Mobile Header */}
        {/* Mobile Header */}
        <header className="md:hidden flex h-14 items-center justify-center border-b border-border px-4 bg-background">
          <span className="font-bold text-lg">LifeOS</span>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-hidden relative">
          <PullToRefresh>
            <div className="p-4 md:p-6 pb-24 md:pb-6 min-h-full">
              <Outlet />
            </div>
          </PullToRefresh>
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
              <NavLink
                key={item.href}
                to={item.href}
                end={item.href === '/'}
                className={({ isActive }) => cn(
                  "flex flex-col items-center justify-center w-full h-full active:opacity-70 transition-all duration-150",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )}
              >
                <item.icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[11px] mt-0.5 font-medium">{item.label}</span>
              </NavLink>
            ))}
          </div>
        </nav>
      </main>
    </div>
  );
}

