import type React from 'react';
import {
  LayoutDashboard,
  Dumbbell,
  Calendar,
  Settings,
  Wallet,
  Target,
  CheckSquare,
  Monitor,
  Moon,
  FileText,
  Focus as FocusIcon,
  BarChart3,
  Coins,
} from 'lucide-react';

export interface NavItem {
  label: string;
  icon: React.ElementType;
  href: string;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { label: 'Tasks', icon: CheckSquare, href: '/tasks' },
  { label: 'Focus', icon: FocusIcon, href: '/focus' },
  { label: 'Habits', icon: Target, href: '/habits' },
  { label: 'Points', icon: Coins, href: '/points' },
  { label: 'Calendar', icon: Calendar, href: '/calendar' },
  { label: 'Notes', icon: FileText, href: '/notes' },
  { label: 'Bio-Metrics', icon: Dumbbell, href: '/health' },
  { label: 'Screen Time', icon: Monitor, href: '/screentime' },
  { label: 'Sleep', icon: Moon, href: '/sleep' },
  { label: 'Analytics', icon: BarChart3, href: '/analytics' },
  { label: 'Finance', icon: Wallet, href: '/finance' },
  { label: 'Settings', icon: Settings, href: '/settings' },
];

