// Send Web Push habit reminders for scheduled habits.
// Rules:
//   1. Only habits with notify_enabled = true are sent.
//   2. Detox habits are NEVER notified (you're trying to stop them).
//   3. Prayer-named habits are excluded via prayer_habits linkage + title prefix guard.
//   4. notify_time (manual) > habit.time (scheduled time) > inferred from completed_at patterns > 9am default.
//   5. ALREADY COMPLETED habits for the day are skipped.
/// <reference path="../deno.d.ts" />

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'https://esm.sh/web-push@3.6.7';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY');
const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');

const DEFAULT_HABIT_NOTIFY_MINUTE = 9 * 60;
const DISPATCH_WINDOW_MINUTES = 2;
const INFERRED_TIME_BUCKET_MINUTES = 15;
const LOOKBACK_DAYS = 30;

// Prayer names to exclude by title prefix (belt-and-suspenders guard alongside prayer_habits linkage)
const PRAYER_PREFIXES = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

type PushSubscriptionRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
  timezone?: string | null;
  user_id?: string | null;
};

type HabitRow = {
  id: string;
  user_id: string;
  title: string;
  time?: string | null;
  notify_time?: string | null; // manual override
  notify_enabled?: boolean | null;
  habit_type?: string | null;  // 'standard' | 'detox' — skip detox
  frequency: string;
  week_days?: number[] | null;
  is_archived?: boolean | null;
};

type HabitLogRow = {
  habit_id: string;
  completed_at: string;
};

type DueHabit = {
  habit: HabitRow;
  timezone: string;
  notifyMinute: number;
  idempotencyKey: string;
};

function getAllowedOrigins(): string[] {
  const raw = Deno.env.get('ALLOWED_ORIGINS') ?? Deno.env.get('APP_ORIGINS') ?? '';
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function corsHeadersFor(origin: string | null): Record<string, string> {
  const allowed = getAllowedOrigins();
  const isAllowed = !!origin && allowed.includes(origin);
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin! : 'null',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
    Vary: 'Origin',
  };
}

if (!vapidPublic || !vapidPrivate) {
  console.error('Missing VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY');
}

webpush.setVapidDetails('mailto:lifeos@example.com', vapidPublic!, vapidPrivate!);

const supabase = createClient(supabaseUrl, serviceRoleKey);

function toLocalDateTime(now: Date, timezone: string): {
  date: string;
  minuteOfDay: number;
  dayOfWeek: number;
} {
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now);
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
  }).format(now);
  const [hour, minute] = time.split(':').map(Number);
  const dayOfWeekMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return {
    date,
    minuteOfDay: hour * 60 + minute,
    dayOfWeek: dayOfWeekMap[weekday] ?? now.getUTCDay(),
  };
}

function normalizeMinuteOfDay(minute: number): number {
  return ((minute % 1440) + 1440) % 1440;
}

function parseTimeToMinutes(time: string): number {
  const [hour = '0', minute = '0'] = time.split(':');
  return normalizeMinuteOfDay(Number(hour) * 60 + Number(minute));
}

function isHabitScheduledForDay(habit: Pick<HabitRow, 'frequency' | 'week_days'>, dayOfWeek: number): boolean {
  if (habit.frequency === 'Daily') return true;
  const weekDays = Array.isArray(habit.week_days) ? habit.week_days : [];
  return weekDays.includes(dayOfWeek);
}

function isDueNow(localMinuteOfDay: number, notifyMinute: number): boolean {
  const delta = (localMinuteOfDay - normalizeMinuteOfDay(notifyMinute) + 1440) % 1440;
  return delta <= DISPATCH_WINDOW_MINUTES;
}

function bucketMinuteOfDay(minuteOfDay: number): number {
  return normalizeMinuteOfDay(
    Math.round(minuteOfDay / INFERRED_TIME_BUCKET_MINUTES) * INFERRED_TIME_BUCKET_MINUTES,
  );
}

function getLocalMinuteOfDay(isoDateTime: string, timezone: string): number | null {
  const value = new Date(isoDateTime);
  if (Number.isNaN(value.getTime())) return null;
  const localTime = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(value);
  const [hour, minute] = localTime.split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

function inferHabitNotifyMinute(logs: HabitLogRow[], timezone: string): number | null {
  if (!logs.length) return null;

  const buckets = new Map<number, { count: number; lastCompletedAt: number }>();
  for (const log of logs) {
    const minuteOfDay = getLocalMinuteOfDay(log.completed_at, timezone);
    if (minuteOfDay == null) continue;
    const bucket = bucketMinuteOfDay(minuteOfDay);
    const completedAt = new Date(log.completed_at).getTime();
    const current = buckets.get(bucket);
    if (!current) {
      buckets.set(bucket, { count: 1, lastCompletedAt: completedAt });
      continue;
    }
    current.count += 1;
    current.lastCompletedAt = Math.max(current.lastCompletedAt, completedAt);
  }

  let bestMinute: number | null = null;
  let bestCount = -1;
  let bestRecency = -1;
  for (const [minute, stats] of buckets.entries()) {
    if (
      stats.count > bestCount ||
      (stats.count === bestCount && stats.lastCompletedAt > bestRecency)
    ) {
      bestMinute = minute;
      bestCount = stats.count;
      bestRecency = stats.lastCompletedAt;
    }
  }

  return bestMinute;
}

function isPrayerTitle(title: string): boolean {
  const t = (title ?? '').trim();
  return PRAYER_PREFIXES.some((name) => t === name || t.startsWith(`${name} (`));
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  const corsHeaders = corsHeadersFor(origin);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const configuredSecrets = [
    Deno.env.get('CRON_SECRET')?.trim(),
    Deno.env.get('HABITS_CRON_SECRET')?.trim(),
  ].filter((s): s is string => Boolean(s && s.length > 0));

  if (configuredSecrets.length > 0) {
    const headerSecret = req.headers.get('x-cron-secret')?.trim();
    const bearerSecret = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
    const apiKeySecret = req.headers.get('apikey')?.trim();
    const providedSecret = headerSecret ?? bearerSecret ?? apiKeySecret;
    const isAuthorized = !!providedSecret && configuredSecrets.some((s) => s === providedSecret);

    if (!isAuthorized) {
      return new Response(JSON.stringify({
        error: 'Unauthorized',
        hint: 'Provide x-cron-secret, Authorization Bearer token, or apikey matching configured secrets.',
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  if (!vapidPublic || !vapidPrivate) {
    return new Response(
      JSON.stringify({ error: 'Server Misconfiguration: Missing VAPID Keys in Supabase Secrets' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  try {
    // First: get timezone→user_id mapping only (no credentials yet = smaller response).
    const { data: tzRows, error: tzRowsError } = await (supabase
      .from('push_subscriptions')
      .select('timezone, user_id') as any)
      .not('user_id', 'is', null);

    if (tzRowsError) throw tzRowsError;

    const allTzRows = ((tzRows ?? []) as PushSubscriptionRow[]).filter((sub) => sub.user_id);

    if (!allTzRows.length) {
      return new Response(JSON.stringify({ ok: true, results: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build timezone → user_ids map (deduped)
    const userIdsByTimezone = new Map<string, string[]>();
    for (const sub of allTzRows) {
      const timezone = sub.timezone?.trim() || 'UTC';
      if (!userIdsByTimezone.has(timezone)) userIdsByTimezone.set(timezone, []);
      userIdsByTimezone.get(timezone)!.push(sub.user_id!);
    }

    const now = new Date();
    const lookbackStartIso = new Date(now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const results: Array<{ timezone: string; due: number; sent: number }> = [];

    for (const [timezone, tzUserIds] of userIdsByTimezone.entries()) {
      try {
        const local = toLocalDateTime(now, timezone);
        const userIds = [...new Set(tzUserIds.filter(Boolean))];
        if (!userIds.length) continue;

        const [{ data: habitsRows, error: habitsError }, { data: prayerHabitRows, error: prayerHabitError }] = await Promise.all([
          (supabase
            .from('habits')
            .select('id, user_id, title, time, notify_time, notify_enabled, habit_type, frequency, week_days, is_archived') as any)
            .in('user_id', userIds)
            .eq('is_archived', false)
            .eq('notify_enabled', true),   // ← Only opted-in habits
          (supabase
            .from('prayer_habits')
            .select('habit_id') as any)
            .in('user_id', userIds)
            .eq('is_active', true),
        ]);

        if (habitsError) throw habitsError;
        if (prayerHabitError) throw prayerHabitError;

        const prayerHabitIds = new Set(((prayerHabitRows ?? []) as Array<{ habit_id: string }>).map((row) => row.habit_id));

        const scheduledHabits = ((habitsRows ?? []) as HabitRow[])
          .filter((habit) => habit.habit_type !== 'detox')          // ← Skip detox habits
          .filter((habit) => !prayerHabitIds.has(habit.id))         // ← Skip prayer-linked habits
          .filter((habit) => !isPrayerTitle(habit.title))            // ← Belt-and-suspenders prayer guard
          .filter((habit) => isHabitScheduledForDay(habit, local.dayOfWeek));

        if (!scheduledHabits.length) continue;

        // ---- NEW: Filter out habits already completed today ----
        const scheduledHabitIds = scheduledHabits.map(h => h.id);
        const { data: todayLogsData, error: todayLogsError } = await (supabase
          .from('habit_logs')
          .select('habit_id') as any)
          .in('habit_id', scheduledHabitIds)
          .eq('date', local.date)
          .eq('completed', true);

        if (todayLogsError) throw todayLogsError;

        const completedTodayIds = new Set(((todayLogsData ?? []) as Array<{ habit_id: string }>).map(log => log.habit_id));

        const pendingHabits = scheduledHabits.filter(habit => !completedTodayIds.has(habit.id));

        if (!pendingHabits.length) continue;
        // --------------------------------------------------------

        // For habits without an explicit notify_time or time, infer from past completed_at
        const habitsNeedingInference = pendingHabits.filter((habit) => !habit.notify_time && !habit.time);
        const inferredTimeByHabit = new Map<string, number>();

        if (habitsNeedingInference.length > 0) {
          const { data: habitLogRows, error: habitLogsError } = await (supabase
            .from('habit_logs')
            .select('habit_id, completed_at') as any)
            .in('habit_id', habitsNeedingInference.map((habit) => habit.id))
            .eq('completed', true)
            .not('completed_at', 'is', null)
            .gte('completed_at', lookbackStartIso);

          if (habitLogsError) throw habitLogsError;

          const logsByHabit = new Map<string, HabitLogRow[]>();
          for (const row of (habitLogRows ?? []) as HabitLogRow[]) {
            const logs = logsByHabit.get(row.habit_id) ?? [];
            logs.push(row);
            logsByHabit.set(row.habit_id, logs);
          }

          for (const habit of habitsNeedingInference) {
            const inferredMinute = inferHabitNotifyMinute(logsByHabit.get(habit.id) ?? [], timezone);
            if (inferredMinute != null) inferredTimeByHabit.set(habit.id, inferredMinute);
          }
        }

        const dueCandidates: DueHabit[] = [];
        for (const habit of pendingHabits) {
          // Priority: notify_time (manual) > habit.time (scheduled) > inferred > 9am default
          const notifyMinute = habit.notify_time
            ? parseTimeToMinutes(habit.notify_time)
            : habit.time
              ? parseTimeToMinutes(habit.time)
              : inferredTimeByHabit.get(habit.id) ?? DEFAULT_HABIT_NOTIFY_MINUTE;

          if (!isDueNow(local.minuteOfDay, notifyMinute)) continue;

          dueCandidates.push({
            habit,
            timezone,
            notifyMinute,
            idempotencyKey: `habit:${habit.user_id}:${habit.id}:${timezone}:${local.date}`,
          });
        }

        if (!dueCandidates.length) continue;

        const unnotifiedCandidates = dueCandidates;

        // Lazily fetch full subscription credentials only for users with due habits.
        const dueUserIds = [...new Set(unnotifiedCandidates.map((c) => c.habit.user_id))];
        const { data: subRows, error: subRowsError } = await (supabase
          .from('push_subscriptions')
          .select('endpoint, p256dh, auth, user_id') as any)
          .in('user_id', dueUserIds);

        if (subRowsError) throw subRowsError;

        const subscriptionsByUser = new Map<string, PushSubscriptionRow[]>();
        for (const sub of ((subRows ?? []) as PushSubscriptionRow[])) {
          if (!sub.user_id || !sub.endpoint || !sub.p256dh || !sub.auth) continue;
          const uid = sub.user_id!;
          if (!subscriptionsByUser.has(uid)) subscriptionsByUser.set(uid, []);
          subscriptionsByUser.get(uid)!.push(sub);
        }

        let sent = 0;
        for (const candidate of unnotifiedCandidates) {
          const userSubscriptions = subscriptionsByUser.get(candidate.habit.user_id) ?? [];
          if (!userSubscriptions.length) continue;

          const isAr = /[\u0600-\u06FF]/.test(candidate.habit.title);
          const titleText = isAr
            ? `يلا عشان دة وقت ${candidate.habit.title}`
            : `Time to focus on ${candidate.habit.title}`;

          const payload = JSON.stringify({
            kind: 'habit',
            habitId: candidate.habit.id,
            title: titleText,
            body: isAr
              ? `حان وقت القيام بعادة "${candidate.habit.title}"`
              : `Time for your habit "${candidate.habit.title}"`,
            route: '/habits',
          });

          let anySuccess = false;
          for (const sub of userSubscriptions) {
            try {
              await webpush.sendNotification(
                { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                payload,
              );
              sent += 1;
              anySuccess = true;
            } catch (error: any) {
              console.error('Habit push failed', sub.endpoint?.slice(0, 50), error);
              if (error?.statusCode === 404 || error?.statusCode === 410) {
                await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
              }
            }
          }
        }

        results.push({ timezone, due: unnotifiedCandidates.length, sent });
      } catch (timezoneError) {
        console.error(`Failed to process habit notifications for ${timezone}`, timezoneError);
      }
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
