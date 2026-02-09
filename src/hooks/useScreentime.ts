import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { ScreentimeAppStat, ScreentimeWebsiteStat, ScreentimeDailySummary } from '../types/schema';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

const QUERY_KEY = ['screentime'];

// Get app stats for a date range
export function useScreentimeAppStats(startDate: string, endDate: string) {
  return useQuery({
    queryKey: [...QUERY_KEY, 'apps', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('screentime_daily_app_stats')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false })
        .order('total_time_seconds', { ascending: false });
      
      if (error) throw error;
      return data as ScreentimeAppStat[];
    },
  });
}

// Get website stats for a date range
export function useScreentimeWebsiteStats(startDate: string, endDate: string) {
  return useQuery({
    queryKey: [...QUERY_KEY, 'websites', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('screentime_daily_website_stats')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false })
        .order('total_time_seconds', { ascending: false });
      
      if (error) throw error;
      return data as ScreentimeWebsiteStat[];
    },
  });
}

// Get daily summaries (switches) for a date range
export function useScreentimeDailySummaries(startDate: string, endDate: string) {
  return useQuery({
    queryKey: [...QUERY_KEY, 'summaries', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('screentime_daily_summary')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });
      
      if (error) throw error;
      return data as ScreentimeDailySummary[];
    },
  });
}

// Get today's screentime summary
export function useTodayScreentime() {
  const today = format(new Date(), 'yyyy-MM-dd');
  
  const { data: appStats = [] } = useScreentimeAppStats(today, today);
  const { data: websiteStats = [] } = useScreentimeWebsiteStats(today, today);
  const { data: summaries = [] } = useScreentimeDailySummaries(today, today);
  
  // Aggregate apps by name first (to avoid double-counting)
  const aggregatedApps = appStats.reduce((acc, stat) => {
    const existing = acc.find(a => a.app_name === stat.app_name);
    if (existing) {
      existing.total_time_seconds += stat.total_time_seconds;
      existing.session_count += stat.session_count;
    } else {
      acc.push({ ...stat });
    }
    return acc;
  }, [] as ScreentimeAppStat[]);
  
  // Aggregate websites by domain first (to avoid double-counting)
  const aggregatedWebsites = websiteStats.reduce((acc, stat) => {
    const existing = acc.find(w => w.domain === stat.domain);
    if (existing) {
      existing.total_time_seconds += stat.total_time_seconds;
      existing.session_count += stat.session_count;
    } else {
      acc.push({ ...stat });
    }
    return acc;
  }, [] as ScreentimeWebsiteStat[]);
  
  // Total = app time only. Website time is a breakdown within the browser app, so adding it would double-count.
  const totalSeconds = aggregatedApps.reduce((sum, stat) => sum + stat.total_time_seconds, 0);
  
  const totalMinutes = Math.round(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  // Top apps (by time) - already aggregated
  const topApps = aggregatedApps
    .sort((a, b) => b.total_time_seconds - a.total_time_seconds)
    .slice(0, 5);
  
  // Top websites - already aggregated
  const topWebsites = aggregatedWebsites
    .sort((a, b) => b.total_time_seconds - a.total_time_seconds)
    .slice(0, 5);
  
  // Calculate total switches for today (sum across all sources/devices)
  const totalSwitches = summaries.reduce((sum, s) => sum + (s.total_switches || 0), 0);

  return {
    totalMinutes,
    totalHours: hours,
    remainingMinutes: minutes,
    topApps,
    topWebsites,
    appCount: appStats.length,
    websiteCount: websiteStats.length,
    totalSwitches,
  };
}

// Get screentime metrics for last N days
export function useScreentimeMetrics(days: number = 30) {
  const endDate = format(new Date(), 'yyyy-MM-dd');
  const startDate = format(subDays(new Date(), days), 'yyyy-MM-dd');
  
  const { data: appStats = [], isLoading: appsLoading } = useScreentimeAppStats(startDate, endDate);
  const { data: websiteStats = [], isLoading: websitesLoading } = useScreentimeWebsiteStats(startDate, endDate);
  const { data: summaries = [], isLoading: summariesLoading } = useScreentimeDailySummaries(startDate, endDate);
  
  // Group by date
  const dailyStats = new Map<string, { apps: number; websites: number; total: number; switches: number }>();
  
  // Aggregate by date and app_name/domain to avoid double-counting
  const dailyAppAggregates = new Map<string, Map<string, number>>();
  const dailyWebsiteAggregates = new Map<string, Map<string, number>>();
  
  appStats.forEach(stat => {
    if (!dailyAppAggregates.has(stat.date)) {
      dailyAppAggregates.set(stat.date, new Map());
    }
    const appMap = dailyAppAggregates.get(stat.date)!;
    const current = appMap.get(stat.app_name) || 0;
    appMap.set(stat.app_name, current + stat.total_time_seconds);
  });
  
  websiteStats.forEach(stat => {
    if (!dailyWebsiteAggregates.has(stat.date)) {
      dailyWebsiteAggregates.set(stat.date, new Map());
    }
    const websiteMap = dailyWebsiteAggregates.get(stat.date)!;
    const current = websiteMap.get(stat.domain) || 0;
    websiteMap.set(stat.domain, current + stat.total_time_seconds);
  });
  
  // Sum aggregated values per day. Total = apps only (websites are browser breakdown, not extra time).
  dailyAppAggregates.forEach((appMap, date) => {
    const existing = dailyStats.get(date) || { apps: 0, websites: 0, total: 0, switches: 0 };
    const appTotal = Array.from(appMap.values()).reduce((sum, val) => sum + val, 0);
    existing.apps += appTotal;
    existing.total += appTotal;
    dailyStats.set(date, existing);
  });

  dailyWebsiteAggregates.forEach((websiteMap, date) => {
    const existing = dailyStats.get(date) || { apps: 0, websites: 0, total: 0, switches: 0 };
    const websiteTotal = Array.from(websiteMap.values()).reduce((sum, val) => sum + val, 0);
    existing.websites += websiteTotal;
    dailyStats.set(date, existing);
  });

  // Add switches from summaries
  summaries.forEach(summary => {
    const existing = dailyStats.get(summary.date) || { apps: 0, websites: 0, total: 0, switches: 0 };
    existing.switches += summary.total_switches || 0;
    dailyStats.set(summary.date, existing);
  });
  
  // Convert to array and sort by date
  const history = Array.from(dailyStats.entries())
    .map(([date, stats]) => ({
      date,
      minutes: Math.round(stats.total / 60),
      appMinutes: Math.round(stats.apps / 60),
      websiteMinutes: Math.round(stats.websites / 60),
      switches: stats.switches,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  // Calculate averages
  const last7Days = history.slice(-7);
  const prev7Days = history.slice(-14, -7);
  
  const avg7Days = last7Days.length > 0
    ? Math.round(last7Days.reduce((sum, d) => sum + d.minutes, 0) / last7Days.length)
    : 0;
  
  const prevAvg7Days = prev7Days.length > 0
    ? Math.round(prev7Days.reduce((sum, d) => sum + d.minutes, 0) / prev7Days.length)
    : 0;
  
  const trend = prevAvg7Days > 0
    ? Math.round(((avg7Days - prevAvg7Days) / prevAvg7Days) * 100)
    : 0;
  
  // Calculate average switches for last 7 days
  const avgSwitches7Days = last7Days.length > 0
    ? Math.round(last7Days.reduce((sum, d) => sum + (d.switches || 0), 0) / last7Days.length)
    : 0;

  // Get today's switches
  const todaySwitches = history.length > 0 ? (history[history.length - 1]?.switches || 0) : 0;

  return {
    history,
    avg7Days,
    trend,
    avgSwitches7Days,
    todaySwitches,
    isLoading: appsLoading || websitesLoading || summariesLoading,
  };
}
