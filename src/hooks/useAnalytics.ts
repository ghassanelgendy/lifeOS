import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export type AnalyticsRangeDays = 7 | 30 | 90;

export interface AnalyticsDailyFinanceRow {
  user_id: string;
  date: string;
  tx_count: number;
  income: number | null;
  expense: number | null;
  balance: number | null;
}

export interface AnalyticsDailySleepRow {
  user_id: string;
  date: string;
  total_minutes: number;
  deep_minutes: number;
  rem_minutes: number;
  core_minutes: number;
  awake_minutes: number;
  first_started_at: string | null;
  last_ended_at: string | null;
}

export interface AnalyticsDailyTasksRow {
  user_id: string;
  date: string;
  completed_count: number;
  focus_time_seconds: number;
  urgent_completed_count: number;
  flagged_completed_count: number;
}

export interface AnalyticsDailyHabitsRow {
  user_id: string;
  date: string;
  logs_count: number;
  completed_count: number;
  adherence_pct: number;
}

export interface AnalyticsDailyScreentimeRow {
  user_id: string;
  date: string;
  platform: string;
  total_switches: number;
  total_apps: number;
  total_time_seconds: number;
  app_time_seconds: number;
  web_time_seconds: number;
}

export interface AnalyticsTopAppRow {
  app_name: string;
  total_time_seconds: number;
  session_count: number;
}

export interface AnalyticsTopDomainRow {
  domain: string;
  total_time_seconds: number;
  session_count: number;
}

export interface AnalyticsTopCategoryRow {
  category: string;
  amount: number;
  tx_count: number;
}

export interface AnalyticsTopMerchantRow {
  merchant: string;
  amount: number;
  tx_count: number;
}

function dateToYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function getRangeBounds(rangeDays: AnalyticsRangeDays, now = new Date()): { start: string; end: string } {
  const end = new Date(now);
  const start = new Date(now);
  start.setDate(start.getDate() - (rangeDays - 1));
  return { start: dateToYmd(start), end: dateToYmd(end) };
}

async function selectRange<T>(viewName: string, start: string, end: string): Promise<T[]> {
  const { data, error } = await supabase
    .from(viewName)
    .select('*')
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: true });
  if (error) throw error;
  return (data ?? []) as T[];
}

export function useAnalyticsDaily(rangeDays: AnalyticsRangeDays) {
  const bounds = useMemo(() => getRangeBounds(rangeDays), [rangeDays]);

  const finance = useQuery({
    queryKey: ['analytics', 'daily', 'finance', bounds.start, bounds.end],
    queryFn: () => selectRange<AnalyticsDailyFinanceRow>('analytics_daily_finance', bounds.start, bounds.end),
  });

  const sleep = useQuery({
    queryKey: ['analytics', 'daily', 'sleep', bounds.start, bounds.end],
    queryFn: () => selectRange<AnalyticsDailySleepRow>('analytics_daily_sleep', bounds.start, bounds.end),
  });

  const tasks = useQuery({
    queryKey: ['analytics', 'daily', 'tasks', bounds.start, bounds.end],
    queryFn: () => selectRange<AnalyticsDailyTasksRow>('analytics_daily_tasks', bounds.start, bounds.end),
  });

  const habits = useQuery({
    queryKey: ['analytics', 'daily', 'habits', bounds.start, bounds.end],
    queryFn: () => selectRange<AnalyticsDailyHabitsRow>('analytics_daily_habits', bounds.start, bounds.end),
  });

  const screentime = useQuery({
    queryKey: ['analytics', 'daily', 'screentime', bounds.start, bounds.end],
    queryFn: () => selectRange<AnalyticsDailyScreentimeRow>('analytics_daily_screentime', bounds.start, bounds.end),
  });

  return { bounds, finance, sleep, tasks, habits, screentime };
}

export function useAnalyticsTop(rangeDays: AnalyticsRangeDays) {
  const bounds = useMemo(() => getRangeBounds(rangeDays), [rangeDays]);

  const topApps = useQuery({
    queryKey: ['analytics', 'top', 'apps', bounds.start, bounds.end],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('analytics_top_apps', {
        start_date: bounds.start,
        end_date: bounds.end,
        limit_n: 10,
      });
      if (error) throw error;
      return (data ?? []) as AnalyticsTopAppRow[];
    },
  });

  const topDomains = useQuery({
    queryKey: ['analytics', 'top', 'domains', bounds.start, bounds.end],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('analytics_top_domains', {
        start_date: bounds.start,
        end_date: bounds.end,
        limit_n: 10,
      });
      if (error) throw error;
      return (data ?? []) as AnalyticsTopDomainRow[];
    },
  });

  const topExpenseCategories = useQuery({
    queryKey: ['analytics', 'top', 'expense_categories', bounds.start, bounds.end],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('analytics_top_expense_categories', {
        start_date: bounds.start,
        end_date: bounds.end,
        limit_n: 10,
      });
      if (error) throw error;
      return (data ?? []) as AnalyticsTopCategoryRow[];
    },
  });

  const topMerchants = useQuery({
    queryKey: ['analytics', 'top', 'merchants', bounds.start, bounds.end],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('analytics_top_merchants', {
        start_date: bounds.start,
        end_date: bounds.end,
        limit_n: 10,
      });
      if (error) throw error;
      return (data ?? []) as AnalyticsTopMerchantRow[];
    },
  });

  return { bounds, topApps, topDomains, topExpenseCategories, topMerchants };
}

