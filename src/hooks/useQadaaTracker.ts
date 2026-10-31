import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { addDays, format, subDays } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { QadaaSettings, QadaaLog, QadaaMadhab, QadaaCalculationBasis } from '../types/schema';

export const LUNAR_DAYS_PER_YEAR = 354.367;
export const SOLAR_DAYS_PER_YEAR = 365.2425;

export const MADHAB_MINIMUMS: Record<QadaaMadhab, { male: number; female: number; label: string }> = {
  shafii: { male: 9, female: 9, label: 'الشافعية (9 سنوات قمرية)' },
  maliki: { male: 9, female: 9, label: 'المالكية (9 سنوات قمرية)' },
  hanbali: { male: 10, female: 9, label: 'الحنابلة (10 سنوات للذكر / 9 للأنثى)' },
  hanafi: { male: 12, female: 9, label: 'الحنفية (12 سنة للذكر / 9 للأنثى)' },
  custom: { male: 14, female: 14, label: 'مخصص / تقديري' },
};

export interface QadaaCalculationParams {
  madhab: QadaaMadhab;
  calculationBasis: QadaaCalculationBasis;
  currentAge: number;
  takleefAge: number;
  isLunarCalendar: boolean;
  includeWitr: boolean;
}

export function calculateQadaaBaseline(params: QadaaCalculationParams) {
  const {
    madhab,
    calculationBasis,
    currentAge,
    takleefAge,
    isLunarCalendar,
    includeWitr,
  } = params;

  let effectiveTakleef = takleefAge;

  if (calculationBasis === 'jumhur_15') {
    effectiveTakleef = 15;
  } else if (calculationBasis === 'madhab_minimum') {
    effectiveTakleef = MADHAB_MINIMUMS[madhab]?.male ?? 14;
  }

  const missedYears = Math.max(0, currentAge - effectiveTakleef);
  const daysPerYear = isLunarCalendar ? LUNAR_DAYS_PER_YEAR : SOLAR_DAYS_PER_YEAR;
  const missedDays = Math.round(missedYears * daysPerYear);

  const targetPerPrayer = missedDays;
  const prayerCount = includeWitr ? 6 : 5;
  const totalTarget = targetPerPrayer * prayerCount;

  return {
    effectiveTakleef,
    missedYears,
    missedDays,
    targetPerPrayer,
    totalTarget,
    includeWitr,
  };
}

export function formatDurationFromDays(totalDays: number) {
  if (totalDays <= 0) return { years: 0, months: 0, days: 0, formatted: '0 أيام' };

  const years = Math.floor(totalDays / 365.25);
  const remainingAfterYears = totalDays % 365.25;
  const months = Math.floor(remainingAfterYears / 30.4375);
  const days = Math.round(remainingAfterYears % 30.4375);

  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ${years === 1 ? 'سنة' : years === 2 ? 'سنتان' : years <= 10 ? 'سنوات' : 'سنة'}`);
  if (months > 0) parts.push(`${months} ${months === 1 ? 'شهر' : months === 2 ? 'شهران' : months <= 10 ? 'أشهر' : 'شهر'}`);
  if (days > 0 && years === 0) parts.push(`${days} ${days === 1 ? 'يوم' : days === 2 ? 'يومان' : 'أيام'}`);

  return {
    years,
    months,
    days,
    formatted: parts.join(' و ') || `${days} أيام`,
  };
}

export type QadaaPrayerKey = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha' | 'witr';

export function useQadaaTracker() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

  // 1. Fetch user Qadaa Settings
  const { data: settings, isLoading: isSettingsLoading } = useQuery({
    queryKey: ['qadaa-settings', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('qadaa_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data as QadaaSettings | null;
    },
    enabled: !!user?.id,
  });

  // 2. Fetch all-time completed sums and recent 30 days logs
  const thirtyDaysAgoStr = useMemo(() => format(subDays(new Date(), 30), 'yyyy-MM-dd'), []);

  const { data: recentLogs = [], isLoading: isRecentLogsLoading } = useQuery({
    queryKey: ['qadaa-recent-logs', user?.id, thirtyDaysAgoStr],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('qadaa_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', thirtyDaysAgoStr)
        .order('date', { ascending: false });

      if (error) throw error;
      return (data || []) as QadaaLog[];
    },
    enabled: !!user?.id,
  });

  // 3. Fetch all-time aggregate totals per prayer
  const { data: allTimeTotals, isLoading: isTotalsLoading } = useQuery({
    queryKey: ['qadaa-totals', user?.id],
    queryFn: async () => {
      if (!user?.id) {
        return { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0, witr: 0, total: 0 };
      }
      const { data, error } = await supabase
        .from('qadaa_logs')
        .select('fajr_count, dhuhr_count, asr_count, maghrib_count, isha_count, witr_count')
        .eq('user_id', user.id);

      if (error) throw error;

      let fajr = 0, dhuhr = 0, asr = 0, maghrib = 0, isha = 0, witr = 0;
      (data || []).forEach((row: any) => {
        fajr += row.fajr_count || 0;
        dhuhr += row.dhuhr_count || 0;
        asr += row.asr_count || 0;
        maghrib += row.maghrib_count || 0;
        isha += row.isha_count || 0;
        witr += row.witr_count || 0;
      });

      return {
        fajr,
        dhuhr,
        asr,
        maghrib,
        isha,
        witr,
        total: fajr + dhuhr + asr + maghrib + isha + witr,
      };
    },
    enabled: !!user?.id,
  });

  const totals = allTimeTotals || { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0, witr: 0, total: 0 };

  // 4. Today's log
  const todayLog = useMemo(() => {
    return recentLogs.find((l) => l.date === todayStr) || {
      id: '',
      user_id: user?.id || '',
      date: todayStr,
      fajr_count: 0,
      dhuhr_count: 0,
      asr_count: 0,
      maghrib_count: 0,
      isha_count: 0,
      witr_count: 0,
      created_at: '',
      updated_at: '',
    };
  }, [recentLogs, todayStr, user?.id]);

  // 5. Effective settings (with sensible defaults if user hasn't initialized yet)
  const effectiveSettings: QadaaSettings = useMemo(() => {
    if (settings) return settings;
    const defBaseline = calculateQadaaBaseline({
      madhab: 'shafii',
      calculationBasis: 'actual_age',
      currentAge: 23,
      takleefAge: 14,
      isLunarCalendar: true,
      includeWitr: false,
    });
    return {
      id: '',
      user_id: user?.id || '',
      madhab: 'shafii',
      calculation_basis: 'actual_age',
      birth_date: null,
      takleef_age: 14,
      current_age: 23,
      is_lunar_calendar: true,
      include_witr: false,
      target_fajr: defBaseline.targetPerPrayer,
      target_dhuhr: defBaseline.targetPerPrayer,
      target_asr: defBaseline.targetPerPrayer,
      target_maghrib: defBaseline.targetPerPrayer,
      target_isha: defBaseline.targetPerPrayer,
      target_witr: 0,
      daily_target_prayers: 5,
      is_active: true,
      created_at: '',
      updated_at: '',
    };
  }, [settings, user?.id]);

  // 6. Remaining counts
  const remaining = useMemo(() => {
    const s = effectiveSettings;
    const remFajr = Math.max(0, s.target_fajr - totals.fajr);
    const remDhuhr = Math.max(0, s.target_dhuhr - totals.dhuhr);
    const remAsr = Math.max(0, s.target_asr - totals.asr);
    const remMaghrib = Math.max(0, s.target_maghrib - totals.maghrib);
    const remIsha = Math.max(0, s.target_isha - totals.isha);
    const remWitr = s.include_witr ? Math.max(0, s.target_witr - totals.witr) : 0;
    const totalRemaining = remFajr + remDhuhr + remAsr + remMaghrib + remIsha + remWitr;
    const totalTarget = s.target_fajr + s.target_dhuhr + s.target_asr + s.target_maghrib + s.target_isha + (s.include_witr ? s.target_witr : 0);
    const completionPct = totalTarget > 0 ? Math.min(100, Math.round(((totalTarget - totalRemaining) / totalTarget) * 1000) / 10) : 0;

    return {
      fajr: remFajr,
      dhuhr: remDhuhr,
      asr: remAsr,
      maghrib: remMaghrib,
      isha: remIsha,
      witr: remWitr,
      total: totalRemaining,
      totalTarget,
      completionPct,
    };
  }, [effectiveSettings, totals]);

  // 7. Dual Velocity & Timeline Forecasting
  const velocityAndForecast = useMemo(() => {
    // 7-day velocity: sum prayers over last 7 days / 7
    const last7DaysLogs = recentLogs.slice(0, 7);
    const sum7Days = last7DaysLogs.reduce((acc, log) => {
      return acc + (log.fajr_count + log.dhuhr_count + log.asr_count + log.maghrib_count + log.isha_count + (effectiveSettings.include_witr ? log.witr_count : 0));
    }, 0);
    const rolling7DayVelocity = Math.round((sum7Days / 7) * 10) / 10;

    // Planned Pace (D)
    const D = Math.max(1, effectiveSettings.daily_target_prayers);
    const targetDaysRemaining = Math.ceil(remaining.total / D);
    const targetFinishDate = addDays(new Date(), targetDaysRemaining);
    const targetDuration = formatDurationFromDays(targetDaysRemaining);

    // Actual Velocity Projection
    const effectiveActualVel = rolling7DayVelocity > 0 ? rolling7DayVelocity : D;
    const actualDaysRemaining = Math.ceil(remaining.total / effectiveActualVel);
    const actualFinishDate = addDays(new Date(), actualDaysRemaining);
    const actualDuration = formatDurationFromDays(actualDaysRemaining);

    const daysDelta = targetDaysRemaining - actualDaysRemaining;
    const isAhead = daysDelta > 0;
    const isBehind = daysDelta < 0;

    return {
      dailyTarget: D,
      rolling7DayVelocity,
      targetDaysRemaining,
      targetFinishDate,
      targetDuration,
      actualDaysRemaining,
      actualFinishDate,
      actualDuration,
      daysDelta,
      isAhead,
      isBehind,
    };
  }, [recentLogs, effectiveSettings, remaining.total]);

  // 8. Mutation to Log Prayer
  const logPrayerMutation = useMutation({
    mutationFn: async ({ prayer, delta, date = todayStr }: { prayer: QadaaPrayerKey; delta: number; date?: string }) => {
      if (!user?.id) return;
      const column = `${prayer}_count` as const;

      // Fetch or use existing today record
      const existing = recentLogs.find((l) => l.date === date);
      const currentVal = existing ? (existing as any)[column] || 0 : 0;
      const nextVal = Math.max(0, currentVal + delta);

      const payload: Record<string, any> = {
        user_id: user.id,
        date,
        [column]: nextVal,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('qadaa_logs')
        .upsert(payload, { onConflict: 'user_id,date' })
        .select('*')
        .single();

      if (error) throw error;
      return data;
    },
    onMutate: async ({ prayer, delta, date = todayStr }) => {
      await queryClient.cancelQueries({ queryKey: ['qadaa-recent-logs', user?.id] });
      await queryClient.cancelQueries({ queryKey: ['qadaa-totals', user?.id] });

      const prevLogs = queryClient.getQueryData<QadaaLog[]>(['qadaa-recent-logs', user?.id, thirtyDaysAgoStr]);
      const prevTotals = queryClient.getQueryData<any>(['qadaa-totals', user?.id]);

      // Optimistic update
      const column = `${prayer}_count` as keyof QadaaLog;
      if (prevLogs) {
        const found = prevLogs.find((l) => l.date === date);
        let nextLogs: QadaaLog[];
        if (found) {
          nextLogs = prevLogs.map((l) =>
            l.date === date ? { ...l, [column]: Math.max(0, (Number(l[column]) || 0) + delta) } : l
          );
        } else {
          const newEntry: QadaaLog = {
            id: 'temp-id',
            user_id: user?.id || '',
            date,
            fajr_count: 0,
            dhuhr_count: 0,
            asr_count: 0,
            maghrib_count: 0,
            isha_count: 0,
            witr_count: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            [column]: Math.max(0, delta),
          };
          nextLogs = [newEntry, ...prevLogs];
        }
        queryClient.setQueryData(['qadaa-recent-logs', user?.id, thirtyDaysAgoStr], nextLogs);
      }

      if (prevTotals) {
        const nextTotals = {
          ...prevTotals,
          [prayer]: Math.max(0, (prevTotals[prayer] || 0) + delta),
          total: Math.max(0, (prevTotals.total || 0) + delta),
        };
        queryClient.setQueryData(['qadaa-totals', user?.id], nextTotals);
      }

      return { prevLogs, prevTotals };
    },
    onError: (_err, _vars, context) => {
      if (context?.prevLogs) {
        queryClient.setQueryData(['qadaa-recent-logs', user?.id, thirtyDaysAgoStr], context.prevLogs);
      }
      if (context?.prevTotals) {
        queryClient.setQueryData(['qadaa-totals', user?.id], context.prevTotals);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['qadaa-recent-logs', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['qadaa-totals', user?.id] });
    },
  });

  // 9. Batch Full Day Mutation (+1 or -1 to all prayers)
  const batchFullDayMutation = useMutation({
    mutationFn: async ({ delta = 1, date = todayStr }: { delta?: number; date?: string }) => {
      if (!user?.id) return;
      const existing = recentLogs.find((l) => l.date === date);

      const nextFajr = Math.max(0, (existing?.fajr_count || 0) + delta);
      const nextDhuhr = Math.max(0, (existing?.dhuhr_count || 0) + delta);
      const nextAsr = Math.max(0, (existing?.asr_count || 0) + delta);
      const nextMaghrib = Math.max(0, (existing?.maghrib_count || 0) + delta);
      const nextIsha = Math.max(0, (existing?.isha_count || 0) + delta);
      const nextWitr = effectiveSettings.include_witr
        ? Math.max(0, (existing?.witr_count || 0) + delta)
        : 0;

      const payload = {
        user_id: user.id,
        date,
        fajr_count: nextFajr,
        dhuhr_count: nextDhuhr,
        asr_count: nextAsr,
        maghrib_count: nextMaghrib,
        isha_count: nextIsha,
        witr_count: nextWitr,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('qadaa_logs')
        .upsert(payload, { onConflict: 'user_id,date' })
        .select('*')
        .single();

      if (error) throw error;
      return data;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['qadaa-recent-logs', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['qadaa-totals', user?.id] });
    },
  });

  // 10. Save Settings Mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async (newSettings: Partial<QadaaSettings>) => {
      if (!user?.id) return;
      const payload = {
        ...newSettings,
        user_id: user.id,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('qadaa_settings')
        .upsert(payload, { onConflict: 'user_id' })
        .select('*')
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['qadaa-settings', user?.id], data);
      queryClient.invalidateQueries({ queryKey: ['qadaa-settings', user?.id] });
    },
  });

  return {
    isConfigured: !!settings,
    isLoading: isSettingsLoading || isRecentLogsLoading || isTotalsLoading,
    settings: effectiveSettings,
    todayLog,
    totals,
    remaining,
    velocityAndForecast,
    incrementPrayer: (prayer: QadaaPrayerKey, amount = 1) =>
      logPrayerMutation.mutate({ prayer, delta: amount }),
    decrementPrayer: (prayer: QadaaPrayerKey, amount = 1) =>
      logPrayerMutation.mutate({ prayer, delta: -amount }),
    batchFullDay: (amount = 1) => batchFullDayMutation.mutate({ delta: amount }),
    saveSettings: (newSettings: Partial<QadaaSettings>) => saveSettingsMutation.mutateAsync(newSettings),
    isSavingSettings: saveSettingsMutation.isPending,
  };
}
