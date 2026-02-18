  import { useState, useMemo, useEffect } from 'react';
  import { format, subDays, subMonths, subWeeks, addWeeks, startOfWeek, endOfWeek, startOfMonth, endOfMonth, getDay, parseISO } from 'date-fns';
  import { Monitor, Globe, TrendingUp, TrendingDown, Clock, RefreshCw, Lightbulb, Calendar, ChevronLeft, ChevronRight, Search } from 'lucide-react';
  import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, LineChart, Line } from 'recharts';
  import { cn } from '../lib/utils';
  import { useTodayScreentime, useScreentimeMetrics, useScreentimeAppStats, useScreentimeWebsiteStats, useScreentimeDailySummaries } from '../hooks/useScreentime';
  import { useUIStore } from '../stores/useUIStore';

  function platformLabel(p: string): string {
    const n = (p || '').toLowerCase();
    return n === 'ios' ? 'IOS' : n === 'windows' ? 'windows' : '';
  }
  function isIosOrWindows(platform: string): boolean {
    const n = (platform || '').toLowerCase();
    return n === 'ios' || n === 'windows';
  }
  /** Format minutes as hours when eligible (e.g. 90 → "1.5h", 45 → "45m"). */
  function formatDurationMinutes(mins: number): string {
    if (mins >= 60) {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return m > 0 ? `${h}h ${m}m` : `${h}h`;
    }
    return `${mins}m`;
  }

  type ViewPeriod = 'today' | 'yesterday' | 'week' | 'month' | 'lastMonth' | '30days' | 'custom';

  export default function Screentime() {
    const { privacyMode, accentTheme } = useUIStore();
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
  const [period, setPeriod] = useState<ViewPeriod>('today');
  const [customDate, setCustomDate] = useState(todayStr);
  const [showAllApps, setShowAllApps] = useState(false);
  const [weekStart, setWeekStart] = useState<string>(() => format(startOfWeek(today), 'yyyy-MM-dd'));
  const [platformFilter, setPlatformFilter] = useState<'all' | 'ios' | 'windows'>('all');
  const [appSearchQuery, setAppSearchQuery] = useState('');

  const getDateRange = (): { start: string; end: string } => {
    switch (period) {
      case 'today':
        // Fetch this week so we have data for weekly charts; cards filter to today only
        return { start: format(startOfWeek(today), 'yyyy-MM-dd'), end: todayStr };
      case 'yesterday': {
          const y = format(subDays(today, 1), 'yyyy-MM-dd');
          return { start: y, end: y };
        }
      case 'week': {
        const weekEndStr = format(endOfWeek(parseISO(weekStart)), 'yyyy-MM-dd');
        // Current week: only show days up to today (e.g. Sun + Mon if today is Monday). Past weeks: full 7 days.
        const end = weekEndStr > todayStr ? todayStr : weekEndStr;
        return { start: weekStart, end };
      }
        case 'month':
          return {
            start: format(startOfMonth(today), 'yyyy-MM-dd'),
            end: format(endOfMonth(today), 'yyyy-MM-dd'),
          };
        case 'lastMonth': {
          const lastMonthDate = subMonths(today, 1);
          return {
            start: format(startOfMonth(lastMonthDate), 'yyyy-MM-dd'),
            end: format(endOfMonth(lastMonthDate), 'yyyy-MM-dd'),
          };
        }
        case '30days':
          return {
            start: format(subDays(today, 30), 'yyyy-MM-dd'),
            end: todayStr,
          };
        case 'custom':
          return { start: customDate, end: customDate };
        default:
          return { start: todayStr, end: todayStr };
      }
    };

    const { start, end } = getDateRange();
    const { data: appStats = [], isLoading: appsLoading } = useScreentimeAppStats(start, end);
    const { data: websiteStats = [], isLoading: websitesLoading } = useScreentimeWebsiteStats(start, end);
    const { data: summaries = [], isLoading: summariesLoading } = useScreentimeDailySummaries(start, end);
    const todayData = useTodayScreentime();
    const { avg7Days, trend, avgSwitches7Days } = useScreentimeMetrics(30);

    const isLoading = appsLoading || websitesLoading || summariesLoading;

    // For single-day periods (today, yesterday, custom), cards/lists show only that day; charts still use full fetched range.
    const displayStart = period === 'today' ? todayStr : period === 'yesterday' ? format(subDays(today, 1), 'yyyy-MM-dd') : period === 'custom' ? customDate : start;
    const displayEnd = period === 'today' ? todayStr : period === 'yesterday' ? format(subDays(today, 1), 'yyyy-MM-dd') : period === 'custom' ? customDate : end;
    const statsForDisplay = useMemo(() => appStats.filter((s) => s.date >= displayStart && s.date <= displayEnd), [appStats, displayStart, displayEnd]);
    const websitesForDisplay = useMemo(() => websiteStats.filter((s) => s.date >= displayStart && s.date <= displayEnd), [websiteStats, displayStart, displayEnd]);
    const summariesForDisplay = useMemo(() => summaries.filter((s) => s.date >= displayStart && s.date <= displayEnd), [summaries, displayStart, displayEnd]);

    // Only iOS and Windows; aggregate by (app_name, platform) — use statsForDisplay so cards show selected day only when Today
    const aggregatedApps = statsForDisplay.reduce((acc, stat) => {
      const platformNorm = (stat.platform || '').toLowerCase();
      if (!isIosOrWindows(stat.platform)) return acc;
      const key = `${stat.app_name}|${platformNorm}`;
      if (!acc[key]) {
        acc[key] = {
          app_name: stat.app_name,
          category: stat.category || 'Uncategorized',
          total_time_seconds: 0,
          session_count: 0,
          platform: stat.platform,
          source: stat.source,
        };
      }
      acc[key].total_time_seconds += stat.total_time_seconds;
      acc[key].session_count += stat.session_count;
      return acc;
    }, {} as Record<string, { app_name: string; category: string; total_time_seconds: number; session_count: number; platform: string; source: string }>);

    const allAppsSorted = Object.values(aggregatedApps)
      .filter((app) => {
        if (platformFilter === 'all') return true;
        const platformNorm = (app.platform || '').toLowerCase();
        return platformFilter === 'ios' ? platformNorm === 'ios' : platformNorm === 'windows';
      })
      .sort((a, b) => b.total_time_seconds - a.total_time_seconds)
      .map((app) => ({
        ...app,
        minutes: Math.round(app.total_time_seconds / 60),
        hours: Math.floor(app.total_time_seconds / 3600),
        remainingMinutes: Math.round((app.total_time_seconds % 3600) / 60),
        platformLabel: platformLabel(app.platform),
      }));
    
    // Filter by search (app name + category)
    const appSearchLower = appSearchQuery.trim().toLowerCase();
    const appsFilteredBySearch = appSearchLower
      ? allAppsSorted.filter(
          (app) =>
            (app.app_name || '').toLowerCase().includes(appSearchLower) ||
            (app.category || '').toLowerCase().includes(appSearchLower)
        )
      : allAppsSorted;
    
    const INITIAL_APPS_SHOWN = 15;
    const topApps = appsFilteredBySearch.slice(0, INITIAL_APPS_SHOWN);
    const appsToShow = showAllApps ? appsFilteredBySearch : topApps;

    // Category breakdown: aggregate by category
    const categoryBreakdown = useMemo(() => {
      const byCategory = new Map<string, { ios: number; windows: number }>();
      
      // Normalize category names (merge variations like "WebBrowsing" and "Web Browsing")
      const normalizeCategory = (cat: string): string => {
        const normalized = (cat || 'Uncategorized').trim();
        // Merge WebBrowsing variations
        if (/^web\s*browsing$/i.test(normalized)) return 'Web Browsing';
        return normalized;
      };
      
      statsForDisplay.forEach((stat) => {
        if (!isIosOrWindows(stat.platform)) return;
        const category = normalizeCategory(stat.category || 'Uncategorized');
        const platformNorm = (stat.platform || '').toLowerCase();
        const existing = byCategory.get(category) || { ios: 0, windows: 0 };
        if (platformNorm === 'ios') existing.ios += stat.total_time_seconds;
        else if (platformNorm === 'windows') existing.windows += stat.total_time_seconds;
        byCategory.set(category, existing);
      });
      const total = Array.from(byCategory.values()).reduce((sum, times) => sum + times.ios + times.windows, 0);
      const allUseHours = Array.from(byCategory.values()).some(times => {
        const iosMin = Math.round(times.ios / 60);
        const winMin = Math.round(times.windows / 60);
        return iosMin >= 60 || winMin >= 60;
      });
      
      return Array.from(byCategory.entries())
        .map(([category, times]) => {
          const iosMinutes = Math.round(times.ios / 60);
          const windowsMinutes = Math.round(times.windows / 60);
          const totalMinutes = iosMinutes + windowsMinutes;
          const totalSeconds = times.ios + times.windows;
          const percentage = total > 0 ? Math.round((totalSeconds / total) * 100) : 0;
          
          // Convert all to the same unit for chart (hours if any category >= 60min, else minutes)
          // This ensures correct ratios
          const iosForChart = allUseHours ? Math.round((times.ios / 3600) * 10) / 10 : iosMinutes;
          const windowsForChart = allUseHours ? Math.round((times.windows / 3600) * 10) / 10 : windowsMinutes;
          
          return {
            category,
            ios: iosForChart, // For chart dataKey (all in same unit)
            windows: windowsForChart, // For chart dataKey (all in same unit)
            iosMinutes,
            windowsMinutes,
            totalMinutes,
            iosHours: Math.round((times.ios / 3600) * 10) / 10,
            windowsHours: Math.round((times.windows / 3600) * 10) / 10,
            totalHours: Math.round((totalSeconds / 3600) * 10) / 10,
            percentage,
            useHours: allUseHours, // Flag for display
          };
        })
        .sort((a, b) => b.totalMinutes - a.totalMinutes)
        .filter(cat => cat.totalMinutes > 0); // Only show categories with time
    }, [statsForDisplay]);

    // Only iOS and Windows — use websitesForDisplay for cards
    const aggregatedWebsites = websitesForDisplay.reduce((acc, stat) => {
      if (!isIosOrWindows(stat.platform)) return acc;
      const platformNorm = (stat.platform || '').toLowerCase();
      const key = `${stat.domain}|${platformNorm}`;
      if (!acc[key]) {
        acc[key] = {
          domain: stat.domain,
          favicon_url: stat.favicon_url ?? undefined,
          total_time_seconds: 0,
          session_count: 0,
          platform: stat.platform,
          source: stat.source,
        };
      }
      acc[key].total_time_seconds += stat.total_time_seconds;
      acc[key].session_count += stat.session_count;
      return acc;
    }, {} as Record<string, { domain: string; favicon_url?: string; total_time_seconds: number; session_count: number; platform: string; source: string }>);

    const topWebsites = Object.values(aggregatedWebsites)
      .sort((a, b) => b.total_time_seconds - a.total_time_seconds)
      .slice(0, 15)
      .map((site) => ({
        ...site,
        minutes: Math.round(site.total_time_seconds / 60),
        hours: Math.floor(site.total_time_seconds / 3600),
        remainingMinutes: Math.round((site.total_time_seconds % 3600) / 60),
        platformLabel: platformLabel(site.platform),
      }));

    // Total = app time only (iOS + Windows). Per-platform breakdown for Total card. Use statsForDisplay so Today shows only today.
    const { totalSeconds, totalMinutes, totalHours, remainingMinutes, iosSeconds, windowsSeconds } = useMemo(() => {
      let ios = 0;
      let win = 0;
      statsForDisplay.forEach((stat) => {
        if (!isIosOrWindows(stat.platform)) return;
        const n = (stat.platform || '').toLowerCase();
        if (n === 'ios') ios += stat.total_time_seconds;
        else if (n === 'windows') win += stat.total_time_seconds;
      });
      const total = ios + win;
      const mins = Math.round(total / 60);
      return {
        totalSeconds: total,
        totalMinutes: mins,
        totalHours: Math.floor(mins / 60),
        remainingMinutes: mins % 60,
        iosSeconds: ios,
        windowsSeconds: win,
      };
    }, [statsForDisplay]);

    // Chart data: only iOS and Windows. When period is 'week' use full week (start..end); else first-to-last day with data.
    const chartData = useMemo(() => {
      const byDate = new Map<string, { ios: number; windows: number }>();

      appStats.forEach((stat) => {
        if (!isIosOrWindows(stat.platform)) return;
        const n = (stat.platform || '').toLowerCase();
        const existing = byDate.get(stat.date) || { ios: 0, windows: 0 };
        if (n === 'ios') existing.ios += stat.total_time_seconds;
        else if (n === 'windows') existing.windows += stat.total_time_seconds;
        byDate.set(stat.date, existing);
      });

      let minDate: string;
      let maxDate: string;
      if (period === 'week' || period === 'today') {
        minDate = start;
        maxDate = end;
      } else {
        const datesWithData = Array.from(byDate.keys()).filter(
          (date) => (byDate.get(date)?.ios ?? 0) > 0 || (byDate.get(date)?.windows ?? 0) > 0
        ).sort();
        if (datesWithData.length === 0) return [];
        minDate = datesWithData[0];
        maxDate = datesWithData[datesWithData.length - 1];
      }

      const dates: string[] = [];
      const d = new Date(minDate);
      const endDate = new Date(maxDate);
      while (d <= endDate) {
        dates.push(format(d, 'yyyy-MM-dd'));
        d.setDate(d.getDate() + 1);
      }

      return dates.map((date) => {
        const row = byDate.get(date) || { ios: 0, windows: 0 };
        return {
          date,
          dateLabel: format(parseISO(date), 'MMM d'),
          ios: Math.round(row.ios / 60),
          windows: Math.round(row.windows / 60),
          minutes: Math.round((row.ios + row.windows) / 60),
        };
      });
    }, [appStats, period, start, end]);

    // Latest date+time with usage per device (for tiny "pushed when" indicator)
    const deviceLastPush = useMemo(() => {
      let windowsLast: string | null = null;
      let iosLast: string | null = null;
      const toTime = (s: {
        date: string;
        last_active_at?: string | null;
        last_seen_at?: string | null;
        updated_at?: string;
        created_at?: string;
      }) => {
        const ts = s.last_active_at || s.last_seen_at || s.updated_at || s.created_at;
        return ts ? new Date(ts).getTime() : new Date(s.date + 'T23:59:59').getTime();
      };
      const pickLatest = (stat: {
        last_active_at?: string | null;
        last_seen_at?: string | null;
        updated_at?: string;
        created_at?: string;
        date: string;
      }) =>
        stat.last_active_at || stat.last_seen_at || stat.updated_at || stat.created_at || stat.date + 'T23:59:59';
      appStats.forEach((stat) => {
        if (!isIosOrWindows(stat.platform)) return;
        const n = (stat.platform || '').toLowerCase();
        const t = toTime(stat);
        if (n === 'windows' && (!windowsLast || t > new Date(windowsLast).getTime())) windowsLast = pickLatest(stat);
        if (n === 'ios' && (!iosLast || t > new Date(iosLast).getTime())) iosLast = pickLatest(stat);
      });
      return { windowsLast, iosLast };
    }, [appStats]);

    // Weekly pattern: aggregate by day of week (in hours) - separate iOS and Windows
    const weeklyPattern = useMemo(() => {
      const dayTotalsIOS: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
      const dayTotalsWindows: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
      const dayCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
      
      // Use appStats instead of history to get platform breakdown
      appStats.forEach(stat => {
        if (!isIosOrWindows(stat.platform)) return;
        const dayOfWeek = getDay(parseISO(stat.date));
        const platformNorm = (stat.platform || '').toLowerCase();
        const minutes = Math.round(stat.total_time_seconds / 60);
        if (platformNorm === 'ios') {
          dayTotalsIOS[dayOfWeek] += minutes;
        } else if (platformNorm === 'windows') {
          dayTotalsWindows[dayOfWeek] += minutes;
        }
        dayCounts[dayOfWeek] += 1;
      });

      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return dayNames.map((name, idx) => {
        const iosHours = dayCounts[idx] > 0 ? Math.round((dayTotalsIOS[idx] / 60) * 10) / 10 : 0;
        const windowsHours = dayCounts[idx] > 0 ? Math.round((dayTotalsWindows[idx] / 60) * 10) / 10 : 0;
        return {
          day: name,
          ios: iosHours,
          windows: windowsHours,
          hours: iosHours + windowsHours, // Total for backward compatibility
          total: dayTotalsIOS[idx] + dayTotalsWindows[idx],
        };
      });
    }, [appStats]);


    // Peak hours estimation using timestamps (if available)
    const peakHoursData = useMemo(() => {
      const hourTotals: Record<number, number> = {};
      let hasTimestampData = false;
      
      // Try to estimate from first_seen_at and last_active_at timestamps
      [...appStats, ...websiteStats].forEach(stat => {
        if (stat.first_seen_at || stat.last_active_at) {
          hasTimestampData = true;
          // Use first_seen_at as a proxy for when activity started
          if (stat.first_seen_at) {
            try {
              const date = parseISO(stat.first_seen_at);
              const hour = date.getHours();
              hourTotals[hour] = (hourTotals[hour] || 0) + stat.total_time_seconds;
            } catch {}
          }
          // Also use last_active_at
          if (stat.last_active_at) {
            try {
              const date = parseISO(stat.last_active_at);
              const hour = date.getHours();
              hourTotals[hour] = (hourTotals[hour] || 0) + stat.total_time_seconds;
            } catch {}
          }
        }
      });

      if (!hasTimestampData) return null;

      // Convert to array and format (12-hour format)
      return Array.from({ length: 24 }, (_, i) => {
        let hour12: number;
        let ampm: string;
        
        if (i === 0) {
          hour12 = 12;
          ampm = 'AM';
        } else if (i === 12) {
          hour12 = 12;
          ampm = 'PM';
        } else if (i > 12) {
          hour12 = i - 12;
          ampm = 'PM';
        } else {
          hour12 = i;
          ampm = 'AM';
        }
        
        return {
          hour: i,
          label: `${hour12}:00 ${ampm}`,
          minutes: Math.round((hourTotals[i] || 0) / 60),
        };
      });
    }, [appStats, websiteStats]);

    // Accent-based shades for charts (one hue, different shades per entity)
    const [accentShades, setAccentShades] = useState<{ base: string; light: string; lighter: string }>({
      base: '#8b5cf6',
      light: '#a78bfa',
      lighter: '#c4b5fd',
    });

    useEffect(() => {
      const root = document.documentElement;
      const accentVar = getComputedStyle(root).getPropertyValue('--color-primary').trim();
      const hex = accentVar && accentVar.startsWith('hsl') ? hslToHex(accentVar) : (accentVar || '#8b5cf6');
      setAccentShades({
        base: hex,
        light: hexLighten(hex, 0.35),
        lighter: hexLighten(hex, 0.55),
      });
    }, [accentTheme]);

    function hexLighten(hex: string, mixWithWhite: number): string {
      const n = hex.replace('#', '');
      const r = parseInt(n.slice(0, 2), 16);
      const g = parseInt(n.slice(2, 4), 16);
      const b = parseInt(n.slice(4, 6), 16);
      const wr = Math.round(r + (255 - r) * mixWithWhite);
      const wg = Math.round(g + (255 - g) * mixWithWhite);
      const wb = Math.round(b + (255 - b) * mixWithWhite);
      return `#${wr.toString(16).padStart(2, '0')}${wg.toString(16).padStart(2, '0')}${wb.toString(16).padStart(2, '0')}`;
    }

    // Helper function to convert HSL to hex
    function hslToHex(hsl: string): string {
      try {
        const matches = hsl.match(/hsl\((\d+)\s+(\d+)%\s+(\d+)%\)/);
        if (!matches) return '#8b5cf6';
        const h = parseInt(matches[1]);
        const s = parseInt(matches[2]) / 100;
        const l = parseInt(matches[3]) / 100;
        
        const c = (1 - Math.abs(2 * l - 1)) * s;
        const x = c * (1 - Math.abs((h / 60) % 2 - 1));
        const m = l - c / 2;
        
        let r = 0, g = 0, b = 0;
        if (h >= 0 && h < 60) {
          r = c; g = x; b = 0;
        } else if (h >= 60 && h < 120) {
          r = x; g = c; b = 0;
        } else if (h >= 120 && h < 180) {
          r = 0; g = c; b = x;
        } else if (h >= 180 && h < 240) {
          r = 0; g = x; b = c;
        } else if (h >= 240 && h < 300) {
          r = x; g = 0; b = c;
        } else if (h >= 300 && h < 360) {
          r = c; g = 0; b = x;
        }
        
        const toHex = (n: number) => {
          const hex = Math.round((n + m) * 255).toString(16);
          return hex.length === 1 ? '0' + hex : hex;
        };
        
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
      } catch {
        return '#8b5cf6';
      }
    }

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Screen Time</h1>
          <p className="text-muted-foreground">
            Track your digital usage across devices
          </p>
        </div>

        {/* Period selector + day filter */}
        <div className="overflow-x-auto -mx-4 px-4">
          <div className="flex items-center gap-2 min-w-max">
            {(['today', 'yesterday', 'week', 'month', 'lastMonth', '30days', 'custom'] as ViewPeriod[]).map((p) => (
              <button
                key={p}
                onClick={() => {
                  setPeriod(p);
                  if (p === 'week') setWeekStart(format(startOfWeek(today), 'yyyy-MM-dd'));
                }}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0',
                  period === p ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                )}
              >
                {p === 'today'
                  ? 'Today'
                  : p === 'yesterday'
                    ? 'Yesterday'
                    : p === 'week'
                      ? 'This Week'
                      : p === 'month'
                        ? 'This Month'
                        : p === 'lastMonth'
                          ? 'Last Month'
                          : p === '30days'
                            ? 'Last 30 Days'
                            : 'Pick a day'}
              </button>
            ))}
            {period === 'custom' && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <Calendar className="text-muted-foreground" size={18} />
                <input
                  type="date"
                  value={customDate}
                  max={todayStr}
                  onChange={(e) => {
                    setCustomDate(e.target.value);
                    setPeriod('custom');
                  }}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
            )}
          </div>
        </div>

        {/* Tiny indicator: which devices pushed and when (date + time, 12h AM/PM) */}
        {(deviceLastPush.windowsLast || deviceLastPush.iosLast) && (
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
            {deviceLastPush.windowsLast && (
              <span title="Windows last had usage at this time">
                <span className="font-medium text-foreground/80">Windows</span>
                <span className="opacity-70"> · {format(parseISO(deviceLastPush.windowsLast), 'd MMM, h:mm a')}</span>
              </span>
            )}
            {deviceLastPush.iosLast && (
              <span title="iOS last had usage at this time">
                <span className="font-medium text-foreground/80">iOS</span>
                <span className="opacity-70"> · {format(parseISO(deviceLastPush.iosLast), 'd MMM, h:mm a')}</span>
              </span>
            )}
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Monitor className="text-blue-500" size={20} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Screen Time</p>
                <p className={cn("text-2xl font-bold tabular-nums", privacyMode && "blur-sm")}>
                  {totalHours > 0 ? `${totalHours}h ${remainingMinutes}m` : `${totalMinutes}m`}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span>windows: {privacyMode ? '•••' : formatDurationMinutes(Math.round(windowsSeconds / 60))}</span>
              <span>IOS: {privacyMode ? '•••' : formatDurationMinutes(Math.round(iosSeconds / 60))}</span>
            </div>
            <div className="flex gap-4 text-xs text-muted-foreground mt-1">
              <span>{Object.keys(aggregatedApps).length} apps</span>
              <span>{Object.keys(aggregatedWebsites).length} sites in browser</span>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <RefreshCw className="text-purple-500" size={20} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Switches</p>
                <p className={cn("text-2xl font-bold tabular-nums", privacyMode && "blur-sm")}>
                  {(() => {
                    try {
                      if (period === 'today') {
                        const switches = todayData?.totalSwitches ?? 0;
                        return switches.toLocaleString();
                      }
                      // For other periods, sum switches from summaries for the selected date range
                      const total = summariesForDisplay.reduce((sum, s) => sum + (s.total_switches || 0), 0);
                      return total.toLocaleString();
                    } catch {
                      return '0';
                    }
                  })()}
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {period === 'today'
                ? 'Today'
                : period === 'yesterday'
                  ? 'Yesterday'
                  : period === 'custom'
                    ? format(parseISO(customDate), 'MMM d, yyyy')
                    : period === 'week'
                      ? 'This week'
                      : period === 'month'
                        ? 'This month'
                        : period === 'lastMonth'
                          ? 'Last month'
                          : 'Last 30 days'}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <TrendingUp className="text-purple-500" size={20} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Top app</p>
                <p className={cn("text-2xl font-bold tabular-nums", privacyMode && "blur-sm")}>
                  {topApps.length > 0
                    ? (() => {
                        const top = topApps[0];
                        return top.hours > 0 ? `${top.hours}h ${top.remainingMinutes}m` : `${top.minutes}m`;
                      })()
                    : '—'}
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {topApps.length > 0 ? topApps[0].app_name : 'No data'}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Monitor className="text-green-500" size={20} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Other apps</p>
                <p className={cn("text-2xl font-bold tabular-nums", privacyMode && "blur-sm")}>
                  {(() => {
                    const otherSeconds = totalSeconds - (topApps.length > 0 ? topApps[0].total_time_seconds : 0);
                    const m = Math.round(otherSeconds / 60);
                    return m > 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
                  })()}
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Rest of your apps
            </p>
          </div>
        </div>

        {/* 7-Day Average */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">7-Day Average</h2>
              {trend !== 0 && (
                <div className={cn("flex items-center gap-1 text-sm font-medium",
                  trend < 0 ? "text-green-500" : "text-red-500"
                )}>
                  {trend < 0 ? <TrendingDown size={16} /> : <TrendingUp size={16} />}
                  {Math.abs(trend)}% vs previous week
                </div>
              )}
            </div>
            <div className="flex items-baseline gap-2">
              <span className={cn("text-4xl font-bold tabular-nums", privacyMode && "blur-sm")}>
                {Math.floor(avg7Days / 60)}h {avg7Days % 60}m
              </span>
              <span className="text-muted-foreground">per day</span>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">7-Day Avg Switches</h2>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={cn("text-4xl font-bold tabular-nums", privacyMode && "blur-sm")}>
                {avgSwitches7Days.toLocaleString()}
              </span>
              <span className="text-muted-foreground">per day</span>
            </div>
            {period === 'today' && (todayData?.totalSwitches || 0) > 0 && (
              <p className="text-sm text-muted-foreground mt-2">
                Today: {(todayData?.totalSwitches || 0).toLocaleString()} switches
              </p>
            )}
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Daily usage: stacked bar by iOS / Windows */}
          {chartData.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="text-lg font-semibold mb-4">Daily usage by device</h2>
              <p className="text-sm text-muted-foreground mb-2">Minutes per day (iOS & Windows)</p>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <XAxis dataKey="dateLabel" />
                  <YAxis />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--color-card)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '0.5rem',
                      boxShadow: 'none',
                    }}
                    cursor={false}
                    formatter={(value, name) => [formatDurationMinutes(Number(value) ?? 0), platformLabel(String(name ?? ''))]}
                    itemStyle={{ color: 'var(--color-foreground)' }}
                    labelStyle={{ color: 'var(--color-muted-foreground)' }}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.dateLabel}
                  />
                  <Legend formatter={(value) => platformLabel(value)} />
                  <Bar dataKey="windows" name="windows" stackId="usage" fill={accentShades.base} isAnimationActive={false} />
                  <Bar dataKey="ios" name="IOS" stackId="usage" fill={accentShades.light} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Usage trend: two overlapping lines (iOS + Windows), same x-axis = days/weeks/months */}
          {chartData.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-lg font-semibold">Usage trend (iOS vs Windows)</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">Minutes per day — both lines share the same dates so you can compare</p>
                </div>
                {period === 'week' && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setWeekStart(format(subWeeks(parseISO(weekStart), 1), 'yyyy-MM-dd'))}
                      className="p-2 rounded-lg border border-border bg-background hover:bg-muted text-foreground transition-colors"
                      aria-label="Previous week"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <span className="text-sm text-muted-foreground min-w-[140px] text-center">
                      {format(parseISO(weekStart), 'd MMM')} – {format(endOfWeek(parseISO(weekStart)), 'd MMM yyyy')}
                    </span>
                    <button
                      type="button"
                      onClick={() => setWeekStart(format(addWeeks(parseISO(weekStart), 1), 'yyyy-MM-dd'))}
                      disabled={addWeeks(parseISO(weekStart), 1) > today}
                      className="p-2 rounded-lg border border-border bg-background hover:bg-muted text-foreground transition-colors disabled:opacity-50 disabled:pointer-events-none"
                      aria-label="Next week"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>
                )}
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <XAxis dataKey="dateLabel" />
                  <YAxis />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--color-card)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '0.5rem',
                      boxShadow: 'none',
                    }}
                    cursor={false}
                    formatter={(value, name) => [formatDurationMinutes(Number(value) ?? 0), platformLabel(String(name ?? ''))]}
                    itemStyle={{ color: 'var(--color-foreground)' }}
                    labelStyle={{ color: 'var(--color-muted-foreground)' }}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.dateLabel}
                  />
                  <Legend formatter={(value) => platformLabel(value)} />
                  <Line type="monotone" dataKey="windows" name="windows" stroke={accentShades.base} strokeWidth={2} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
                  <Line type="monotone" dataKey="ios" name="IOS" stroke={accentShades.light} strokeWidth={2} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Category Breakdown */}
          {categoryBreakdown.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-6 lg:col-span-2">
              <h2 className="text-lg font-semibold mb-4">Time by Category</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Breakdown of screen time by app category ({formatDurationMinutes(categoryBreakdown.reduce((sum, c) => sum + c.totalMinutes, 0))} total)
              </p>
              <ResponsiveContainer width="100%" height={Math.max(300, categoryBreakdown.length * 50)}>
                <BarChart 
                  data={categoryBreakdown} 
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
                >
                  <XAxis 
                    type="number" 
                    label={{ 
                      value: categoryBreakdown.length > 0 && categoryBreakdown[0].useHours ? 'Hours' : 'Minutes', 
                      position: 'insideBottom', 
                      offset: -5 
                    }}
                    tickFormatter={(value) => {
                      const useHours = categoryBreakdown.length > 0 && categoryBreakdown[0].useHours;
                      return useHours ? `${value}h` : `${value}m`;
                    }}
                  />
                  <YAxis 
                    type="category" 
                    dataKey="category" 
                    width={110}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--color-card)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '0.5rem',
                      boxShadow: 'none',
                    }}
                    cursor={false}
                    formatter={(value: any, name: any, item: any) => {
                      const numValue = Number(value) ?? 0;
                      const payload = item?.payload;
                      const useHours = payload?.useHours;
                      
                      if (useHours) {
                        // Convert hours back to minutes for display
                        const minutes = name === 'IOS' ? payload?.iosMinutes : payload?.windowsMinutes || 0;
                        return [`${formatDurationMinutes(minutes)}`, platformLabel(String(name ?? ''))];
                      } else {
                        return [`${formatDurationMinutes(numValue)}`, platformLabel(String(name ?? ''))];
                      }
                    }}
                    labelFormatter={(label, payload) => {
                      const data = payload?.[0]?.payload;
                      if (data) {
                        return `${data.category} (${data.percentage}%)`;
                      }
                      return label;
                    }}
                    itemStyle={{ color: 'var(--color-foreground)' }}
                    labelStyle={{ color: 'var(--color-muted-foreground)' }}
                  />
                  <Legend formatter={(value) => platformLabel(value)} />
                  <Bar dataKey="ios" name="IOS" stackId="category" fill={accentShades.light} isAnimationActive={false} />
                  <Bar dataKey="windows" name="windows" stackId="category" fill={accentShades.base} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Weekly Pattern */}
          {weeklyPattern.some(d => d.hours > 0) && (
            <div className="rounded-xl border border-border bg-card p-6 lg:col-span-2">
              <h2 className="text-lg font-semibold mb-4">Weekly Pattern</h2>
              <p className="text-sm text-muted-foreground mb-4">Average hours per day of week (iOS vs Windows)</p>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={weeklyPattern}>
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'var(--color-card)', 
                      border: '1px solid var(--color-border)',
                      borderRadius: '0.5rem',
                      boxShadow: 'none'
                    }}
                    cursor={false}
                    formatter={(value, name) => [`${typeof value === 'number' ? value.toFixed(1) : 0}h`, platformLabel(String(name ?? ''))]}
                    itemStyle={{ color: 'var(--color-foreground)' }}
                    labelStyle={{ color: 'var(--color-muted-foreground)' }}
                  />
                  <Legend formatter={(value) => platformLabel(value)} />
                  <Bar dataKey="ios" name="IOS" fill={accentShades.light} isAnimationActive={false} />
                  <Bar dataKey="windows" name="windows" fill={accentShades.base} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Peak Hours */}
          {peakHoursData ? (
            <div className="rounded-xl border border-border bg-card p-6 lg:col-span-2">
              <h2 className="text-lg font-semibold mb-4">Peak Hours</h2>
              <p className="text-sm text-muted-foreground mb-4">Estimated based on activity timestamps</p>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={peakHoursData}>
                  <XAxis dataKey="label" interval={2} />
                  <YAxis />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'var(--color-card)', 
                      border: '1px solid var(--color-border)',
                      borderRadius: '0.5rem',
                      boxShadow: 'none'
                    }}
                    cursor={false}
                    formatter={(value) => [`${typeof value === 'number' ? value : 0}m`, 'Minutes']}
                    itemStyle={{ color: 'var(--color-foreground)' }}
                    labelStyle={{ color: 'var(--color-muted-foreground)' }}
                  />
                  <Bar dataKey="minutes" fill={accentShades.light} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
              <p className="text-xs text-muted-foreground mt-2">
                Note: For accurate hourly data, enable hourly tracking in your PC app
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card p-6 lg:col-span-2">
              <h2 className="text-lg font-semibold mb-2">Peak Hours</h2>
              <p className="text-sm text-muted-foreground">
                Hourly data not available. Enable hourly tracking in your PC tracker to see peak usage hours throughout the day.
              </p>
            </div>
          )}
        </div>

        {/* Apps (with source/platform) — See more shows all */}
        {allAppsSorted.length > 0 && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-6 border-b border-border space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h2 className="text-lg font-semibold">Apps</h2>
                  <p className="text-sm text-muted-foreground">Source (IOS, windows) shown per app</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Platform filter */}
                  <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-1">
                    {(['all', 'ios', 'windows'] as const).map((pf) => (
                      <button
                        key={pf}
                        type="button"
                        onClick={() => setPlatformFilter(pf)}
                        className={cn(
                          'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                          platformFilter === pf
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                        )}
                      >
                        {pf === 'all' ? 'All' : pf === 'ios' ? 'IOS' : 'Windows'}
                      </button>
                    ))}
                  </div>
                  {appsFilteredBySearch.length > INITIAL_APPS_SHOWN && (
                    <button
                      type="button"
                      onClick={() => setShowAllApps((v) => !v)}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {showAllApps ? 'Show less' : `See all apps (${appsFilteredBySearch.length})`}
                    </button>
                  )}
                </div>
              </div>
              {/* App search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={18} />
                <input
                  type="search"
                  placeholder="Search apps or category..."
                  value={appSearchQuery}
                  onChange={(e) => setAppSearchQuery(e.target.value)}
                  className={cn(
                    'w-full pl-9 py-2 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
                    appSearchQuery ? 'pr-9' : 'pr-4'
                  )}
                />
                {appSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setAppSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground rounded"
                    aria-label="Clear search"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
            <div className="divide-y divide-border">
              {appsToShow.length > 0 ? appsToShow.map((app, idx) => (
                <div key={idx} className="p-4 hover:bg-secondary/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Monitor size={18} className="text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium truncate">{app.app_name}</p>
                          {app.platformLabel && (
                            <span className="inline-flex items-center rounded-md bg-secondary px-1.5 py-0.5 text-xs font-medium text-secondary-foreground shrink-0">
                              {app.platformLabel}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {app.category}
                          {app.platform.toLowerCase() !== 'ios' && ` · ${app.session_count} sessions`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                      <p className={cn('font-bold tabular-nums', privacyMode && 'blur-sm')}>
                        {app.hours > 0 ? `${app.hours}h ${app.remainingMinutes}m` : `${app.minutes}m`}
                      </p>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  No apps match &quot;{appSearchQuery}&quot;. Try another search or clear the filter.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Top Websites (with source/platform) */}
        {topWebsites.length > 0 && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-6 border-b border-border">
              <h2 className="text-lg font-semibold">Top Websites</h2>
              <p className="text-sm text-muted-foreground">Source (iOS, Windows) shown per site</p>
            </div>
            <div className="divide-y divide-border">
              {topWebsites.map((site, idx) => (
                <div key={idx} className="p-4 hover:bg-secondary/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {site.favicon_url ? (
                        <img
                          src={site.favicon_url}
                          alt=""
                          className="w-10 h-10 rounded-lg flex-shrink-0"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
                          <Globe size={18} className="text-green-500" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium truncate">{site.domain}</p>
                          {site.platformLabel && (
                            <span className="inline-flex items-center rounded-md bg-secondary px-1.5 py-0.5 text-xs font-medium text-secondary-foreground shrink-0">
                              {site.platformLabel}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{site.session_count} sessions</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                      <p className={cn('font-bold tabular-nums', privacyMode && 'blur-sm')}>
                        {site.hours > 0 ? `${site.hours}h ${site.remainingMinutes}m` : `${site.minutes}m`}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Insights — at the end */}
        {!isLoading && (totalSeconds > 0 || summariesForDisplay.length > 0) && (
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="text-amber-500" size={20} />
              <h2 className="text-lg font-semibold">Insights</h2>
            </div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {totalMinutes > 0 && (
                <li>
                  <span className="font-medium text-foreground">Total screen time</span> in this period:{' '}
                  {formatDurationMinutes(totalMinutes)} (windows: {formatDurationMinutes(Math.round(windowsSeconds / 60))}, IOS: {formatDurationMinutes(Math.round(iosSeconds / 60))}).
                </li>
              )}
              {topApps.length > 0 && (
                <li>
                  <span className="font-medium text-foreground">Top app</span>: {topApps[0].app_name}
                  {topApps[0].platformLabel && (
                    <span className="ml-1 inline-flex items-center rounded-md bg-secondary px-1.5 py-0.5 text-xs font-medium text-secondary-foreground">
                      {topApps[0].platformLabel}
                    </span>
                  )}{' '}
                  — {topApps[0].hours > 0 ? `${topApps[0].hours}h ${topApps[0].remainingMinutes}m` : `${topApps[0].minutes}m`}.
                </li>
              )}
              {iosSeconds + windowsSeconds > 0 && (
                <li>
                  <span className="font-medium text-foreground">Most used device</span> in this period:{' '}
                  {windowsSeconds >= iosSeconds ? 'windows' : 'IOS'}.
                </li>
              )}
              {trend !== 0 && (
                <li>
                  <span className="font-medium text-foreground">7-day trend</span>: {trend > 0 ? 'up' : 'down'} {Math.abs(trend)}% vs previous week.
                </li>
              )}
              {summariesForDisplay.reduce((s, x) => s + (x.total_switches || 0), 0) > 0 && (
                <li>
                  <span className="font-medium text-foreground">App switches</span> in this period: {summariesForDisplay.reduce((s, x) => s + (x.total_switches || 0), 0).toLocaleString()}.
                </li>
              )}
            </ul>
          </div>
        )}

        {isLoading && (
          <div className="text-center py-12 text-muted-foreground">
            <Clock className="mx-auto mb-2 opacity-50 animate-spin" size={24} />
            <p>Loading screentime data...</p>
          </div>
        )}

        {!isLoading && topApps.length === 0 && topWebsites.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Monitor className="mx-auto mb-2 opacity-50" size={48} />
            <p className="text-lg font-medium mb-1">No screentime data</p>
            <p className="text-sm">Upload data from your PC or mobile tracker to see your usage here.</p>
          </div>
        )}
      </div>
    );
  }
