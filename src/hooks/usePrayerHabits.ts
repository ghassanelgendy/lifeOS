/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { usePrayerTimes } from './usePrayerTimes';
import type { PrayerHabit, PrayerLog, PrayerName, PrayerNotificationSetting, PrayerStatus } from '../types/schema';

const PRAYER_NAMES: PrayerName[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
const QUERY_KEY = ['prayer-tracker'];

const toDateOnly = (d: Date) => format(d, 'yyyy-MM-dd');
const toTimeOnly = (d: Date) => format(d, 'HH:mm:ss');

type JoinedPrayerHabit = PrayerHabit & {
  habit?: { id: string; title: string; color: string } | null;
};

export type PrayerTrackerItem = {
  prayerName: PrayerName;
  prayerHabitId: string;
  habitId: string;
  habitTitle: string;
  color: string;
  defaultTime?: string | null;
  status: PrayerStatus | null;
  prayedAt?: string | null;
  logId?: string;
};

async function upsertPrayerLogWithHabitSync(input: {
  prayerHabitId: string;
  habitId: string;
  date: string;
  status: PrayerStatus;
}) {
  const nowIso = new Date().toISOString();
  const prayedAt = input.status === 'Prayed' ? nowIso : null;

  const { data: existingPrayerLog } = await supabase
    .from('prayer_logs')
    .select('id')
    .eq('prayer_habit_id', input.prayerHabitId)
    .eq('date', input.date)
    .maybeSingle();

  let prayerLogId: string;
  if (existingPrayerLog?.id) {
    const { data, error } = await supabase
      .from('prayer_logs')
      .update({
        status: input.status,
        prayed_at: prayedAt,
        updated_at: nowIso,
      })
      .eq('id', existingPrayerLog.id)
      .select('id')
      .single();
    if (error) throw error;
    prayerLogId = data.id as string;
  } else {
    const { data, error } = await supabase
      .from('prayer_logs')
      .insert({
        prayer_habit_id: input.prayerHabitId,
        date: input.date,
        status: input.status,
        prayed_at: prayedAt,
      })
      .select('id')
      .single();
    if (error) throw error;
    prayerLogId = data.id as string;
  }

  const { data: existingHabitLog } = await supabase
    .from('habit_logs')
    .select('id')
    .eq('habit_id', input.habitId)
    .eq('date', input.date)
    .maybeSingle();

  const completed = input.status === 'Prayed';
  let habitLogId: string;
  if (existingHabitLog?.id) {
    const { data, error } = await supabase
      .from('habit_logs')
      .update({
        completed,
        source: 'prayer',
      })
      .eq('id', existingHabitLog.id)
      .select('id')
      .single();
    if (error) throw error;
    habitLogId = data.id as string;
  } else {
    const { data, error } = await supabase
      .from('habit_logs')
      .insert({
        habit_id: input.habitId,
        date: input.date,
        completed,
        source: 'prayer',
      })
      .select('id')
      .single();
    if (error) throw error;
    habitLogId = data.id as string;
  }

  await supabase
    .from('prayer_logs')
    .update({ habit_log_id: habitLogId })
    .eq('id', prayerLogId);
}

async function ensurePrayerRows(
  userId: string,
  times: { name: string; time: Date }[]
): Promise<void> {
  const { data: existingHabits, error: prayerHabitsErr } = await supabase
    .from('prayer_habits')
    .select('*')
    .eq('user_id', userId);
  if (prayerHabitsErr) throw prayerHabitsErr;

  const byName = new Map<PrayerName, PrayerHabit>();
  ((existingHabits || []) as PrayerHabit[]).forEach((row) => byName.set(row.prayer_name, row));

  for (const prayerName of PRAYER_NAMES) {
    const prayerTime = times.find((t) => t.name === prayerName)?.time;
    const timeOnly = prayerTime ? toTimeOnly(prayerTime) : null;
    const displayTime = prayerTime ? format(prayerTime, 'h:mm a') : 'time';
    const desiredTitle = `${prayerName} (${displayTime})`;
    const existing = byName.get(prayerName);

    if (!existing) {
      const { data: createdHabit, error: createHabitErr } = await supabase
        .from('habits')
        .insert({
          title: desiredTitle,
          description: `Daily ${prayerName} prayer`,
          frequency: 'Daily',
          target_count: 1,
          color: '#8b5cf6',
          is_archived: false,
        })
        .select('id')
        .single();
      if (createHabitErr) throw createHabitErr;

      const { data: prayerHabit, error: createPrayerHabitErr } = await supabase
        .from('prayer_habits')
        .insert({
          prayer_name: prayerName,
          habit_id: createdHabit.id,
          default_time: timeOnly,
          is_active: true,
        })
        .select('*')
        .single();
      if (createPrayerHabitErr) throw createPrayerHabitErr;
      byName.set(prayerName, prayerHabit as PrayerHabit);
      continue;
    }

    const updates: Record<string, unknown> = {};
    if (timeOnly && existing.default_time !== timeOnly) updates.default_time = timeOnly;
    if (Object.keys(updates).length > 0) {
      await supabase.from('prayer_habits').update(updates).eq('id', existing.id);
    }

    await supabase.from('habits').update({
      title: desiredTitle,
      description: `Daily ${prayerName} prayer at ${displayTime}`,
      color: '#8b5cf6',
    }).eq('id', existing.habit_id);
  }
}

export function usePrayerTracker(date: Date = new Date()) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { times } = usePrayerTimes();
  const dateStr = toDateOnly(date);
  const timesSignature = useMemo(
    () => times.filter((t) => PRAYER_NAMES.includes(t.name as PrayerName)).map((t) => `${t.name}:${toTimeOnly(t.time)}`).join('|'),
    [times]
  );

  useEffect(() => {
    if (!user?.id || !timesSignature) return;
    void ensurePrayerRows(user.id, times).then(() => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, user.id, 'habits'] });
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, user.id, 'today', dateStr] });
    }).catch((e) => console.error('Prayer habit sync failed', e));
  }, [user?.id, timesSignature, times, queryClient, dateStr]);

  const habitsQuery = useQuery({
    queryKey: [...QUERY_KEY, user?.id, 'habits'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prayer_habits')
        .select('*, habit:habits(id,title,color)')
        .eq('user_id', user!.id)
        .eq('is_active', true);
      if (error) throw error;
      return (data ?? []) as JoinedPrayerHabit[];
    },
    enabled: !!user?.id,
  });

  const logsQuery = useQuery({
    queryKey: [...QUERY_KEY, user?.id, 'today', dateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prayer_logs')
        .select('*')
        .eq('user_id', user!.id)
        .eq('date', dateStr);
      if (error) throw error;
      return (data ?? []) as PrayerLog[];
    },
    enabled: !!user?.id,
  });

  const weeklyQuery = useQuery({
    queryKey: [...QUERY_KEY, user?.id, 'weekly', dateStr],
    queryFn: async () => {
      const start = new Date(date);
      start.setDate(start.getDate() - 6);
      const startStr = toDateOnly(start);
      const { data, error } = await supabase
        .from('prayer_logs')
        .select('*')
        .eq('user_id', user!.id)
        .gte('date', startStr)
        .lte('date', dateStr);
      if (error) throw error;
      return (data ?? []) as PrayerLog[];
    },
    enabled: !!user?.id,
  });

  const settingsQuery = useQuery({
    queryKey: [...QUERY_KEY, user?.id, 'settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prayer_notification_settings')
        .select('*')
        .eq('user_id', user!.id);
      if (error) throw error;
      return (data ?? []) as PrayerNotificationSetting[];
    },
    enabled: !!user?.id,
  });

  const tracker = useMemo<PrayerTrackerItem[]>(() => {
    const habits = habitsQuery.data ?? [];
    const logs = logsQuery.data ?? [];
    const byPrayer = new Map<PrayerName, PrayerTrackerItem>();

    habits.forEach((ph) => {
      const log = logs.find((l) => l.prayer_habit_id === ph.id);
      byPrayer.set(ph.prayer_name, {
        prayerName: ph.prayer_name,
        prayerHabitId: ph.id,
        habitId: ph.habit_id,
        habitTitle: ph.habit?.title ?? ph.prayer_name,
        color: ph.habit?.color ?? '#8b5cf6',
        defaultTime: ph.default_time,
        status: log?.status ?? null,
        prayedAt: log?.prayed_at ?? null,
        logId: log?.id,
      });
    });

    return PRAYER_NAMES.map((p) => byPrayer.get(p)).filter(Boolean) as PrayerTrackerItem[];
  }, [habitsQuery.data, logsQuery.data]);

  const completionRate = useMemo(() => {
    if (tracker.length === 0) return 0;
    const done = tracker.filter((t) => t.status === 'Prayed').length;
    return Math.round((done / tracker.length) * 100);
  }, [tracker]);

  const weeklyCompletion = useMemo(() => {
    const logs = weeklyQuery.data ?? [];
    const map = new Map<string, number>();
    logs.forEach((l) => {
      if (l.status !== 'Prayed') return;
      map.set(l.date, (map.get(l.date) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .map(([date, prayed]) => ({ date, prayed, percent: Math.round((prayed / PRAYER_NAMES.length) * 100) }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [weeklyQuery.data]);

  const upsertPrayer = useMutation({
    mutationFn: async (input: { prayer: PrayerTrackerItem; status: PrayerStatus }) => {
      const existing = (logsQuery.data ?? []).find(
        (l) => l.prayer_habit_id === input.prayer.prayerHabitId
      );

      // If user clicks the same status again, treat it as "undo":
      // remove the prayer_log entry and reset the linked habit_log.
      if (existing && existing.status === input.status) {
        const { error: deleteLogErr } = await supabase
          .from('prayer_logs')
          .delete()
          .eq('id', existing.id);
        if (deleteLogErr) throw deleteLogErr;

        if (existing.habit_log_id) {
          const { error: resetHabitErr } = await supabase
            .from('habit_logs')
            .update({
              completed: false,
              source: 'prayer',
            })
            .eq('id', existing.habit_log_id);
          if (resetHabitErr) throw resetHabitErr;
        }

        return;
      }

      await upsertPrayerLogWithHabitSync({
        prayerHabitId: input.prayer.prayerHabitId,
        habitId: input.prayer.habitId,
        date: dateStr,
        status: input.status,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, user?.id, 'today', dateStr] });
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, user?.id, 'weekly', dateStr] });
      queryClient.invalidateQueries({ queryKey: ['habit-logs'] });
      queryClient.invalidateQueries({ queryKey: ['habits'] });
    },
  });

  const upsertNotificationSetting = useMutation({
    mutationFn: async (input: {
      prayerHabitId: string;
      enabled: boolean;
      offsetMinutes?: number;
      timezone?: string;
      quietHoursStart?: string | null;
      quietHoursEnd?: string | null;
    }) => {
      const existing = (settingsQuery.data ?? []).find((s) => s.prayer_habit_id === input.prayerHabitId);
      const timezone = input.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      if (existing) {
        const { error } = await supabase
          .from('prayer_notification_settings')
          .update({
            enabled: input.enabled,
            offset_minutes: input.offsetMinutes ?? existing.offset_minutes,
            timezone,
            quiet_hours_start: input.quietHoursStart ?? existing.quiet_hours_start ?? null,
            quiet_hours_end: input.quietHoursEnd ?? existing.quiet_hours_end ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase
        .from('prayer_notification_settings')
        .insert({
          prayer_habit_id: input.prayerHabitId,
          enabled: input.enabled,
          offset_minutes: input.offsetMinutes ?? 0,
          timezone,
          quiet_hours_start: input.quietHoursStart ?? null,
          quiet_hours_end: input.quietHoursEnd ?? null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, user?.id, 'settings'] });
    },
  });

  return {
    isLoading: habitsQuery.isLoading || logsQuery.isLoading,
    tracker,
    completionRate,
    weeklyCompletion,
    settings: settingsQuery.data ?? [],
    togglePrayerStatus: (prayer: PrayerTrackerItem, status: PrayerStatus) =>
      upsertPrayer.mutate({ prayer, status }),
    setPrayerNotifications: (
      prayerHabitId: string,
      enabled: boolean,
      options?: { offsetMinutes?: number; timezone?: string; quietHoursStart?: string | null; quietHoursEnd?: string | null }
    ) => upsertNotificationSetting.mutate({
      prayerHabitId,
      enabled,
      offsetMinutes: options?.offsetMinutes,
      timezone: options?.timezone,
      quietHoursStart: options?.quietHoursStart,
      quietHoursEnd: options?.quietHoursEnd,
    }),
  };
}

export function useSetPrayerStatusAtDate() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (input: { prayerHabitId: string; habitId: string; date: string; status: PrayerStatus }) =>
      upsertPrayerLogWithHabitSync(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, user?.id] });
      queryClient.invalidateQueries({ queryKey: ['habit-logs'] });
      queryClient.invalidateQueries({ queryKey: ['habits'] });
    },
  });

  return {
    setPrayerStatusAtDate: mutation.mutate,
    isUpdating: mutation.isPending,
  };
}

/**
 * Lightweight hook for Settings: get prayer notification state and enable/disable all at once.
 */
export function usePrayerNotificationSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const timezone = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC';

  const { data: prayerHabits = [], isLoading: habitsLoading } = useQuery({
    queryKey: [...QUERY_KEY, user?.id, 'habits'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prayer_habits')
        .select('id')
        .eq('user_id', user!.id)
        .eq('is_active', true);
      if (error) throw error;
      return (data ?? []) as { id: string }[];
    },
    enabled: !!user?.id,
  });

  const { data: settings = [], isLoading: settingsLoading } = useQuery({
    queryKey: [...QUERY_KEY, user?.id, 'settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prayer_notification_settings')
        .select('*')
        .eq('user_id', user!.id);
      if (error) throw error;
      return (data ?? []) as PrayerNotificationSetting[];
    },
    enabled: !!user?.id,
  });

  const setAllMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      for (const ph of prayerHabits) {
        const existing = settings.find((s) => s.prayer_habit_id === ph.id);
        const tz = existing?.timezone ?? timezone;
        if (existing) {
          await supabase
            .from('prayer_notification_settings')
            .update({
              enabled,
              timezone: tz,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);
        } else {
          await supabase.from('prayer_notification_settings').insert({
            prayer_habit_id: ph.id,
            enabled,
            offset_minutes: 0,
            timezone: tz,
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, user?.id, 'settings'] });
    },
  });

  const allEnabled =
    prayerHabits.length > 0 &&
    prayerHabits.every((ph) => settings.find((s) => s.prayer_habit_id === ph.id)?.enabled === true);

  return {
    isLoading: habitsLoading || settingsLoading,
    prayerHabitsCount: prayerHabits.length,
    allEnabled: !!allEnabled,
    setAllEnabled: (enabled: boolean) => setAllMutation.mutate(enabled),
    isUpdating: setAllMutation.isPending,
  };
}
