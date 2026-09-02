import { useEffect, useMemo, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { getPrayerStatusChoices, isPrayerStatusComplete } from '../lib/prayerStatus';
import { useAuth } from '../contexts/AuthContext';
import { usePrayerTimes } from './usePrayerTimes';
import type { PrayerHabit, PrayerLog, PrayerName, PrayerNotificationSetting, PrayerStatus } from '../types/schema';
import { isOnline } from '../lib/offlineSync';
import { idbAddPointsTransaction } from '../db/indexedDb';
import { isDateEligibleForPoints } from './usePoints';
import { v4 as uuidv4 } from 'uuid';


const PRAYER_NAMES: PrayerName[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
const QUERY_KEY = ['prayer-tracker'];

const toDateOnly = (d: Date) => format(d, 'yyyy-MM-dd');
const toTimeOnly = (d: Date) => format(d, 'HH:mm:ss');

type JoinedPrayerHabit = PrayerHabit & {
  habit?: { id: string; title: string; color: string } | null;
};

type PrayerHabitWithHabit = PrayerHabit & {
  habit?: { id: string; title: string; description: string | null; time: string | null; color: string } | null;
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
  userId?: string;
  prayerHabitId: string;
  habitId: string;
  date: string;
  status: PrayerStatus;
  habitTitle: string;
}) {
  const nowIso = new Date().toISOString();
  const prayedAt = isPrayerStatusComplete(input.status) ? nowIso : null;
  const completed = isPrayerStatusComplete(input.status);

  let userId = input.userId;
  if (!userId) {
    const { data: authData } = await supabase.auth.getUser();
    userId = authData?.user?.id;
  }

  // Fetch both existing logs in parallel to save a roundtrip
  const [existingPrayerLogRes, existingHabitLogRes] = await Promise.all([
    supabase
      .from('prayer_logs')
      .select('id, status')
      .eq('prayer_habit_id', input.prayerHabitId)
      .eq('date', input.date)
      .maybeSingle(),
    supabase
      .from('habit_logs')
      .select('id')
      .eq('habit_id', input.habitId)
      .eq('date', input.date)
      .maybeSingle()
  ]);

  const existingPrayerLog = existingPrayerLogRes.data;
  const existingHabitLog = existingHabitLogRes.data;
  const oldStatus = existingPrayerLog?.status ?? null;

  let habitLogId = existingHabitLog?.id;

  // If habit log doesn't exist, we must create it first to link its ID
  if (!habitLogId) {
    const { data: newHabitLog, error: habitErr } = await supabase
      .from('habit_logs')
      .insert({
        habit_id: input.habitId,
        date: input.date,
        completed,
        source: 'prayer',
        ...(userId && { user_id: userId }),
      })
      .select('id')
      .single();
    if (habitErr) throw habitErr;
    habitLogId = newHabitLog.id;
  }

  // Update/insert everything concurrently
  const promises: Promise<any>[] = [];

  if (existingHabitLog?.id) {
    promises.push(
      supabase
        .from('habit_logs')
        .update({
          completed,
          source: 'prayer',
          ...(userId && { user_id: userId }),
        })
        .eq('id', existingHabitLog.id)
    );
  }

  if (existingPrayerLog?.id) {
    promises.push(
      supabase
        .from('prayer_logs')
        .update({
          status: input.status,
          prayed_at: prayedAt,
          habit_log_id: habitLogId,
          ...(userId && { user_id: userId }),
          updated_at: nowIso,
        })
        .eq('id', existingPrayerLog.id)
    );
  } else {
    promises.push(
      supabase
        .from('prayer_logs')
        .insert({
          prayer_habit_id: input.prayerHabitId,
          date: input.date,
          status: input.status,
          prayed_at: prayedAt,
          habit_log_id: habitLogId,
          ...(userId && { user_id: userId }),
        })
    );
  }

  const results = await Promise.all(promises);
  for (const res of results) {
    if (res.error) throw res.error;
  }

  return { oldStatus, habitTitle: input.habitTitle };
}

async function ensurePrayerRows(
  userId: string,
  times: { name: string; time: Date }[]
): Promise<void> {
  const { data: existingHabits, error: prayerHabitsErr } = await supabase
    .from('prayer_habits')
    .select('*, habit:habits(id, title, description, time, color)')
    .eq('user_id', userId);
  if (prayerHabitsErr) throw prayerHabitsErr;

  const byName = new Map<PrayerName, PrayerHabitWithHabit>();
  ((existingHabits || []) as PrayerHabitWithHabit[]).forEach((row) => byName.set(row.prayer_name, row));

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
          time: timeOnly,
          target_count: 1,
          adherence_weight: 1,
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
      byName.set(prayerName, prayerHabit as PrayerHabitWithHabit);
      continue;
    }

    const updates: Record<string, unknown> = {};
    if (timeOnly && existing.default_time !== timeOnly) updates.default_time = timeOnly;
    if (Object.keys(updates).length > 0) {
      await supabase.from('prayer_habits').update(updates).eq('id', existing.id);
    }

    const currentHabit = existing.habit;
    const currentTitle = currentHabit?.title;
    const currentDesc = currentHabit?.description;
    const currentTime = currentHabit?.time;
    const currentColor = currentHabit?.color;

    const desiredDesc = `Daily ${prayerName} prayer at ${displayTime}`;
    const desiredColor = '#8b5cf6';

    const habitUpdates: Record<string, unknown> = {};
    if (desiredTitle !== currentTitle) habitUpdates.title = desiredTitle;
    if (desiredDesc !== currentDesc) habitUpdates.description = desiredDesc;
    if (timeOnly !== currentTime) habitUpdates.time = timeOnly;
    if (desiredColor !== currentColor) habitUpdates.color = desiredColor;

    if (Object.keys(habitUpdates).length > 0) {
      await supabase.from('habits').update(habitUpdates).eq('id', existing.habit_id);
    }
  }
}

const syncedDatesWeb = new Set<string>();

function getPrayerStatusPenalty(status: PrayerStatus | null): number {
  if (!status) return 0;
  if (status === 'Late') return -25;
  if (status === 'Missed' || status === 'Skipped') return -50;
  return 0; // 'Prayed' has no penalty
}

async function adjustPointsForPrayerToggle(
  userId: string,
  prayerTitle: string,
  prayerHabitId: string,
  oldStatus: PrayerStatus | null,
  newStatus: PrayerStatus | null
) {
  if (!isDateEligibleForPoints(new Date())) return;

  const oldPenalty = getPrayerStatusPenalty(oldStatus);
  const newPenalty = getPrayerStatusPenalty(newStatus);
  const amount = newPenalty - oldPenalty;

  if (amount === 0) return;

  const txId = uuidv4();
  const desc = amount < 0
    ? `Prayer Penalty (${newStatus}): ${prayerTitle}`
    : `Reverted Prayer Penalty (${oldStatus}): ${prayerTitle}`;

  const payload = {
    id: txId,
    user_id: userId,
    amount,
    description: desc,
    reference_type: 'prayer',
    reference_id: prayerHabitId,
    created_at: new Date().toISOString(),
  };

  if (isOnline()) {
    try {
      await supabase.from('points_transactions').insert(payload);
    } catch {
      await idbAddPointsTransaction({ ...payload, is_synced: false });
    }
  } else {
    await idbAddPointsTransaction({ ...payload, is_synced: false });
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

  const timesRef = useRef(times);
  useEffect(() => {
    timesRef.current = times;
  }, [times]);

  useEffect(() => {
    if (!user?.id || !timesSignature) return;
    if (syncedDatesWeb.has(dateStr)) return; // Prevent duplicate daily syncs in this session

    syncedDatesWeb.add(dateStr);

    void ensurePrayerRows(user.id, timesRef.current).then(() => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, user.id, 'habits'] });
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, user.id, 'today', dateStr] });
    }).catch(() => {
      syncedDatesWeb.delete(dateStr);
    });
  }, [user?.id, timesSignature, queryClient, dateStr]);

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
    staleTime: 1000 * 60 * 60, // 1 hour (almost static)
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
    staleTime: 1000 * 60 * 5, // 5 minutes
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
    staleTime: 1000 * 60 * 15, // 15 minutes
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
    staleTime: 1000 * 60 * 60, // 1 hour (almost static)
  });

  // Auto-overdue marking disabled to prevent altering user prayer logs.

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
    const done = tracker.filter((t) => isPrayerStatusComplete(t.status)).length;
    return Math.round((done / tracker.length) * 100);
  }, [tracker]);

  const weeklyCompletion = useMemo(() => {
    const logs = weeklyQuery.data ?? [];
    const map = new Map<string, number>();
    logs.forEach((l) => {
      if (!isPrayerStatusComplete(l.status)) return;
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

      const oldStatus = existing ? existing.status : null;

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

        if (user?.id) {
          await adjustPointsForPrayerToggle(
            user.id,
            input.prayer.habitTitle,
            input.prayer.prayerHabitId,
            oldStatus,
            null
          );
        }

        return;
      }

      const result = await upsertPrayerLogWithHabitSync({
        userId: user?.id,
        prayerHabitId: input.prayer.prayerHabitId,
        habitId: input.prayer.habitId,
        date: dateStr,
        status: input.status,
        habitTitle: input.prayer.habitTitle,
      });

      if (user?.id) {
        await adjustPointsForPrayerToggle(
          user.id,
          result.habitTitle,
          input.prayer.prayerHabitId,
          result.oldStatus,
          input.status
        );
      }
    },

    onMutate: async (input: { prayer: PrayerTrackerItem; status: PrayerStatus }) => {
      const todayKey = [...QUERY_KEY, user?.id, 'today', dateStr];
      const prayerLogsKey = ['prayer-logs'];

      await queryClient.cancelQueries({ queryKey: todayKey });
      await queryClient.cancelQueries({ queryKey: prayerLogsKey });

      const previousLogs = queryClient.getQueryData(todayKey);
      const previousPrayerLogs = queryClient.getQueriesData({ queryKey: prayerLogsKey });

      queryClient.setQueryData(todayKey, (old: any) => {
        if (!Array.isArray(old)) return old;
        const newLogs = [...old];
        const existingIndex = newLogs.findIndex((l) => l.prayer_habit_id === input.prayer.prayerHabitId);
        
        if (existingIndex >= 0) {
          if (newLogs[existingIndex].status === input.status) {
            // Undo case
            newLogs.splice(existingIndex, 1);
          } else {
            // Update case
            newLogs[existingIndex] = {
              ...newLogs[existingIndex],
              status: input.status,
              prayed_at: isPrayerStatusComplete(input.status) ? new Date().toISOString() : null,
            };
          }
        } else {
          // Insert case
          newLogs.push({
            id: `optimistic-${Date.now()}`,
            prayer_habit_id: input.prayer.prayerHabitId,
            date: dateStr,
            status: input.status,
            prayed_at: isPrayerStatusComplete(input.status) ? new Date().toISOString() : null,
          });
        }
        return newLogs;
      });

      // Optimistically update prayer-logs
      queryClient.setQueriesData({ queryKey: prayerLogsKey }, (old: any) => {
        if (!Array.isArray(old)) return old;
        const newLogs = [...old];
        const existingIndex = newLogs.findIndex(
          (l) => l.prayer_habit_id === input.prayer.prayerHabitId && l.date === dateStr
        );
        if (existingIndex >= 0) {
          if (newLogs[existingIndex].status === input.status) {
            newLogs.splice(existingIndex, 1);
          } else {
            newLogs[existingIndex] = {
              ...newLogs[existingIndex],
              status: input.status,
            };
          }
        } else {
          newLogs.push({
            prayer_habit_id: input.prayer.prayerHabitId,
            date: dateStr,
            status: input.status,
          });
        }
        return newLogs;
      });

      return { previousLogs, todayKey, previousPrayerLogs };
    },
    onError: (_err, _variables, context: any) => {
      if (context?.previousLogs) {
        queryClient.setQueryData(context.todayKey, context.previousLogs);
      }
      if (context?.previousPrayerLogs) {
        context.previousPrayerLogs.forEach(([queryKey, data]: [any, any]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, user?.id, 'today', dateStr] });
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, user?.id, 'weekly', dateStr] });
      queryClient.invalidateQueries({ queryKey: ['habit-logs'] });
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      queryClient.invalidateQueries({ queryKey: ['prayer-logs'] });
      queryClient.invalidateQueries({ queryKey: ['points-transactions'] });
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
    statusOptions: getPrayerStatusChoices(),
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
    mutationKey: ['set-prayer-status', user?.id],
    mutationFn: async (input: { prayerHabitId: string; habitId: string; date: string; status: PrayerStatus }) => {
      const habits = queryClient.getQueryData<JoinedPrayerHabit[]>([...QUERY_KEY, user?.id, 'habits']) || [];
      const habit = habits.find((h) => h.id === input.prayerHabitId);
      const habitTitle = habit?.habit?.title ?? habit?.prayer_name ?? 'Prayer';

      const result = await upsertPrayerLogWithHabitSync({
        userId: user?.id,
        prayerHabitId: input.prayerHabitId,
        habitId: input.habitId,
        date: input.date,
        status: input.status,
        habitTitle,
      });
      if (user?.id) {
        await adjustPointsForPrayerToggle(
          user.id,
          result.habitTitle,
          input.prayerHabitId,
          result.oldStatus,
          input.status
        );
      }
      return result;
    },
    onMutate: async (input) => {
      const trackerKeyPrefix = [...QUERY_KEY, user?.id];
      const prayerLogsKey = ['prayer-logs'];

      await queryClient.cancelQueries({ queryKey: trackerKeyPrefix });
      await queryClient.cancelQueries({ queryKey: prayerLogsKey });

      const previousQueries = queryClient.getQueriesData({ queryKey: trackerKeyPrefix });
      const previousPrayerLogs = queryClient.getQueriesData({ queryKey: prayerLogsKey });

      const nowIso = new Date().toISOString();
      const prayedAt = isPrayerStatusComplete(input.status) ? nowIso : null;

      // Update tracker queries (today, weekly, backlog, etc.)
      queryClient.setQueriesData(
        {
          queryKey: trackerKeyPrefix,
          predicate: (query) =>
            query.queryKey.includes('today') ||
            query.queryKey.includes('weekly') ||
            query.queryKey.includes('backlog')
        },
        (old: any) => {
          if (!Array.isArray(old)) return old;

          const newLogs = [...old];
          const existingIndex = newLogs.findIndex(
            (l) => l.prayer_habit_id === input.prayerHabitId && l.date === input.date
          );

          if (existingIndex >= 0) {
            newLogs[existingIndex] = {
              ...newLogs[existingIndex],
              status: input.status,
              prayed_at: prayedAt,
              updated_at: nowIso,
            };
          } else {
            newLogs.push({
              id: `optimistic-${Date.now()}-${Math.random()}`,
              user_id: user?.id,
              prayer_habit_id: input.prayerHabitId,
              date: input.date,
              status: input.status,
              prayed_at: prayedAt,
              created_at: nowIso,
              updated_at: nowIso,
            });
          }
          return newLogs;
        }
      );

      // Update prayer-logs (for weekly calculations)
      queryClient.setQueriesData({ queryKey: prayerLogsKey }, (old: any) => {
        if (!Array.isArray(old)) return old;
        const newLogs = [...old];
        const existingIndex = newLogs.findIndex(
          (l) => l.prayer_habit_id === input.prayerHabitId && l.date === input.date
        );
        if (existingIndex >= 0) {
          newLogs[existingIndex] = {
            ...newLogs[existingIndex],
            status: input.status,
            prayed_at: prayedAt,
          };
        } else {
          newLogs.push({
            id: `optimistic-${Date.now()}-${Math.random()}`,
            user_id: user?.id,
            prayer_habit_id: input.prayerHabitId,
            date: input.date,
            status: input.status,
            prayed_at: prayedAt,
          });
        }
        return newLogs;
      });

      return { previousQueries, previousPrayerLogs };
    },
    onError: (_err, _variables, context: any) => {
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]: [any, any]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousPrayerLogs) {
        context.previousPrayerLogs.forEach(([queryKey, data]: [any, any]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: ['set-prayer-status', user?.id] }) <= 1) {
        queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, user?.id], refetchType: 'active' });
        queryClient.invalidateQueries({ queryKey: ['habit-logs'], refetchType: 'active' });
        queryClient.invalidateQueries({ queryKey: ['habits'], refetchType: 'active' });
        queryClient.invalidateQueries({ queryKey: ['prayer-logs'], refetchType: 'active' });
        queryClient.invalidateQueries({ queryKey: ['points-transactions'], refetchType: 'active' });
      }
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
    queryKey: [...QUERY_KEY, user?.id, 'notification-habits'],
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
