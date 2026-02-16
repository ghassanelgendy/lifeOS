import { useState, useMemo, useEffect } from 'react';
import { format, subDays, subMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth, getDay, parseISO } from 'date-fns';
import { Monitor, Globe, TrendingUp, TrendingDown, Clock, RefreshCw } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, AreaChart, Area } from 'recharts';
import { cn } from '../lib/utils';
import { useTodayScreentime, useScreentimeMetrics, useScreentimeAppStats, useScreentimeWebsiteStats, useScreentimeDailySummaries } from '../hooks/useScreentime';
import { useUIStore } from '../stores/useUIStore';

type ViewPeriod = 'today' | 'week' | 'month' | 'lastMonth' | '30days';

export default function Screentime() {
  const { privacyMode, accentTheme } = useUIStore();
  const [period, setPeriod] = useState<ViewPeriod>('today');
  const today = new Date();
  
  // Get date ranges based on period
  const getDateRange = () => {
    switch (period) {
      case 'today':
        const todayStr = format(today, 'yyyy-MM-dd');
        return { start: todayStr, end: todayStr };
      case 'week':
        return {
          start: format(startOfWeek(today), 'yyyy-MM-dd'),
          end: format(endOfWeek(today), 'yyyy-MM-dd'),
        };
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
          end: format(today, 'yyyy-MM-dd'),
        };
    }
  };

  const { start, end } = getDateRange();
  const { data: appStats = [], isLoading: appsLoading } = useScreentimeAppStats(start, end);
  const { data: websiteStats = [], isLoading: websitesLoading } = useScreentimeWebsiteStats(start, end);
  const { data: summaries = [], isLoading: summariesLoading } = useScreentimeDailySummaries(start, end);
  const todayData = useTodayScreentime();
  const { history, avg7Days, trend, avgSwitches7Days } = useScreentimeMetrics(30);

  const isLoading = appsLoading || websitesLoading || summariesLoading;

  // Aggregate apps by name
  const aggregatedApps = appStats.reduce((acc, stat) => {
    const key = stat.app_name;
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
  }, {} as Record<string, any>);

  const topApps = Object.values(aggregatedApps)
    .sort((a: any, b: any) => b.total_time_seconds - a.total_time_seconds)
    .slice(0, 10)
    .map((app: any) => ({
      ...app,
      minutes: Math.round(app.total_time_seconds / 60),
      hours: Math.floor(app.total_time_seconds / 3600),
      remainingMinutes: Math.round((app.total_time_seconds % 3600) / 60),
    }));

  // Aggregate websites by domain
  const aggregatedWebsites = websiteStats.reduce((acc, stat) => {
    const key = stat.domain;
    if (!acc[key]) {
      acc[key] = {
        domain: stat.domain,
        favicon_url: stat.favicon_url,
        total_time_seconds: 0,
        session_count: 0,
      };
    }
    acc[key].total_time_seconds += stat.total_time_seconds;
    acc[key].session_count += stat.session_count;
    return acc;
  }, {} as Record<string, any>);

  const topWebsites = Object.values(aggregatedWebsites)
    .sort((a: any, b: any) => b.total_time_seconds - a.total_time_seconds)
    .slice(0, 10)
    .map((site: any) => ({
      ...site,
      minutes: Math.round(site.total_time_seconds / 60),
      hours: Math.floor(site.total_time_seconds / 3600),
      remainingMinutes: Math.round((site.total_time_seconds % 3600) / 60),
    }));

  // Total = app time only. Websites are tracked inside the browser app, so adding them would double-count.
  const totalAppSeconds = Object.values(aggregatedApps).reduce((sum: number, app: any) => sum + app.total_time_seconds, 0);
  const totalSeconds = totalAppSeconds;
  const totalMinutes = Math.round(totalSeconds / 60);
  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;

  // Prepare chart data by source so desktop + phone are aggregated in one timeline.
  const chartData = useMemo(() => {
    const byDate = new Map<string, { desktop: number; phone: number; other: number }>();

    const getSourceBucket = (sourceValue: string, platformValue: string) => {
      const sourceNorm = (sourceValue || '').toLowerCase();
      const platformNorm = (platformValue || '').toLowerCase();

      if (sourceNorm === 'mobile' || sourceNorm === 'phone' || platformNorm === 'ios' || platformNorm === 'android') {
        return 'phone' as const;
      }
      if (sourceNorm === 'pc' || sourceNorm === 'desktop' || ['windows', 'macos', 'linux'].includes(platformNorm)) {
        return 'desktop' as const;
      }
      return 'other' as const;
    };

    appStats.forEach((stat) => {
      const existing = byDate.get(stat.date) || { desktop: 0, phone: 0, other: 0 };
      const bucket = getSourceBucket(stat.source, stat.platform);
      existing[bucket] += stat.total_time_seconds;
      byDate.set(stat.date, existing);
    });

    summaries.forEach((summary) => {
      if (!byDate.has(summary.date)) {
        byDate.set(summary.date, { desktop: 0, phone: 0, other: 0 });
      }
    });

    return Array.from(byDate.entries())
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .map(([date, values]) => ({
        date,
        dateLabel: format(parseISO(date), 'MMM d'),
        desktop: Math.round(values.desktop / 60),
        phone: Math.round(values.phone / 60),
        other: Math.round(values.other / 60),
        minutes: Math.round((values.desktop + values.phone + values.other) / 60),
      }));
  }, [appStats, summaries]);

  // Weekly pattern: aggregate by day of week (in hours)
  const weeklyPattern = useMemo(() => {
    const dayTotals: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    const dayCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    
    history.forEach(d => {
      const dayOfWeek = getDay(parseISO(d.date));
      dayTotals[dayOfWeek] += d.minutes;
      dayCounts[dayOfWeek] += 1;
    });

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return dayNames.map((name, idx) => ({
      day: name,
      hours: dayCounts[idx] > 0 ? Math.round((dayTotals[idx] / dayCounts[idx]) / 60 * 10) / 10 : 0, // Round to 1 decimal place
      total: dayTotals[idx],
    }));
  }, [history]);


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

      {/* Period Selector */}
      <div className="flex gap-2">
        {(['today', 'week', 'month', 'lastMonth', '30days'] as ViewPeriod[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              period === p
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            )}
          >
            {p === 'today'
              ? 'Today'
              : p === 'week'
                ? 'This Week'
                : p === 'month'
                  ? 'This Month'
                  : p === 'lastMonth'
                    ? 'Last Month'
                    : '30 Days'}
          </button>
        ))}
      </div>

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
          <div className="flex gap-4 text-sm text-muted-foreground">
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
                    const total = summaries.reduce((sum, s) => sum + (s.total_switches || 0), 0);
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
                  const otherSeconds = totalAppSeconds - (topApps.length > 0 ? topApps[0].total_time_seconds : 0);
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
        {/* Daily Usage Bar Chart */}
        {chartData.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold mb-4">Daily Usage by Source</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <XAxis dataKey="dateLabel" />
                <YAxis />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'var(--color-card)', 
                    border: '1px solid var(--color-border)',
                    borderRadius: '0.5rem',
                    boxShadow: 'none'
                  }}
                  cursor={false}
                  formatter={(value, name) => {
                    const label = name === 'desktop' ? 'Desktop' : name === 'phone' ? 'Phone' : 'Other';
                    return [`${typeof value === 'number' ? value : 0}m`, label];
                  }}
                  itemStyle={{ color: 'var(--color-foreground)' }}
                  labelStyle={{ color: 'var(--color-muted-foreground)' }}
                />
                <Legend />
                <Bar dataKey="desktop" fill={accentShades.base} name="Desktop" stackId="usage" isAnimationActive={false} />
                <Bar dataKey="phone" fill={accentShades.light} name="Phone" stackId="usage" isAnimationActive={false} />
                <Bar dataKey="other" fill={accentShades.lighter} name="Other" stackId="usage" isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Usage Trend Line Chart */}
        {chartData.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold mb-4">Usage Trend by Source</h2>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorDesktop" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={accentShades.base} stopOpacity={0.35}/>
                    <stop offset="95%" stopColor={accentShades.base} stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorPhone" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={accentShades.light} stopOpacity={0.35}/>
                    <stop offset="95%" stopColor={accentShades.light} stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorOtherSource" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={accentShades.lighter} stopOpacity={0.35}/>
                    <stop offset="95%" stopColor={accentShades.lighter} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="dateLabel" />
                <YAxis />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'var(--color-card)', 
                    border: '1px solid var(--color-border)',
                    borderRadius: '0.5rem',
                    boxShadow: 'none'
                  }}
                  cursor={false}
                  formatter={(value, name) => {
                    const label = name === 'desktop' ? 'Desktop' : name === 'phone' ? 'Phone' : 'Other';
                    return [`${typeof value === 'number' ? value : 0}m`, label];
                  }}
                  itemStyle={{ color: 'var(--color-foreground)' }}
                  labelStyle={{ color: 'var(--color-muted-foreground)' }}
                />
                <Legend />
                <Area type="monotone" dataKey="desktop" stroke={accentShades.base} fillOpacity={1} fill="url(#colorDesktop)" name="Desktop" />
                <Area type="monotone" dataKey="phone" stroke={accentShades.light} fillOpacity={1} fill="url(#colorPhone)" name="Phone" />
                <Area type="monotone" dataKey="other" stroke={accentShades.lighter} fillOpacity={1} fill="url(#colorOtherSource)" name="Other" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Weekly Pattern */}
        {weeklyPattern.some(d => d.hours > 0) && (
          <div className="rounded-xl border border-border bg-card p-6 lg:col-span-2">
            <h2 className="text-lg font-semibold mb-4">Weekly Pattern</h2>
            <p className="text-sm text-muted-foreground mb-4">Average hours per day of week</p>
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
                  formatter={(value) => [`${typeof value === 'number' ? value.toFixed(1) : 0}h`, 'Avg Hours']}
                  itemStyle={{ color: 'var(--color-foreground)' }}
                  labelStyle={{ color: 'var(--color-muted-foreground)' }}
                />
                <Bar dataKey="hours" fill={accentShades.base} isAnimationActive={false} />
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

      {/* Top Apps */}
      {topApps.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="p-6 border-b border-border">
            <h2 className="text-lg font-semibold">Top Apps</h2>
          </div>
          <div className="divide-y divide-border">
            {topApps.map((app, idx) => (
              <div key={idx} className="p-4 hover:bg-secondary/30 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Monitor size={18} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{app.app_name}</p>
                      <p className="text-sm text-muted-foreground">{app.category}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <p className={cn("font-bold tabular-nums", privacyMode && "blur-sm")}>
                      {app.hours > 0 ? `${app.hours}h ${app.remainingMinutes}m` : `${app.minutes}m`}
                    </p>
                    <p className="text-xs text-muted-foreground">{app.session_count} sessions</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Websites */}
      {topWebsites.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="p-6 border-b border-border">
            <h2 className="text-lg font-semibold">Top Websites</h2>
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
                      <p className="font-medium truncate">{site.domain}</p>
                      <p className="text-sm text-muted-foreground">{site.session_count} sessions</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <p className={cn("font-bold tabular-nums", privacyMode && "blur-sm")}>
                      {site.hours > 0 ? `${site.hours}h ${site.remainingMinutes}m` : `${site.minutes}m`}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
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
