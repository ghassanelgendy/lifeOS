import type React from 'react';
import {
  LayoutDashboard,
  Dumbbell,
  GraduationCap,
  Calendar,
  Settings,
  Wallet,
  Target,
  CheckSquare,
  Monitor,
  Moon,
  Focus as FocusIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  icon: React.ElementType;
  href: string;
}

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

