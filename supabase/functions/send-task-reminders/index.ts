// Send Web Push task reminders for tasks whose reminder time is this minute (in each user TZ).
// Reminder time = due_date + due_time - early_reminder_minutes (so "5 min before" fires 5 min before due).
// Call this every minute via cron. Requires: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY in Supabase secrets.
/// <reference path="../deno.d.ts" />

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'https://esm.sh/web-push@3.6.7';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY');
const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');

function getAllowedOrigins(): string[] {
  const raw = Deno.env.get('ALLOWED_ORIGINS') ?? Deno.env.get('APP_ORIGINS') ?? '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function corsHeadersFor(origin: string | null): Record<string, string> {
  const allowed = getAllowedOrigins();
  const isAllowed = !!origin && allowed.includes(origin);
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin! : 'null',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
    'Vary': 'Origin',
  };
}

// Early reminder offsets we support (minutes before due time). 0 = at due time.
const EARLY_OFFSETS = [0, 5, 10, 15, 30, 60];

function formatInTz(date: Date, tz: string, dateStyle: 'date' | 'time'): string {
  if (dateStyle === 'date') {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date); // YYYY-MM-DD
  }
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date); // HH:mm
}

if (!vapidPublic || !vapidPrivate) {
  console.error('Missing VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY');
}

webpush.setVapidDetails('mailto:lifeos@example.com', vapidPublic!, vapidPrivate!);

const supabase = createClient(supabaseUrl, serviceRoleKey);

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  const corsHeaders = corsHeadersFor(origin);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // Cron-only endpoint: require shared secret when configured.
  const configuredSecrets = [
    Deno.env.get('CRON_SECRET')?.trim(),
    Deno.env.get('TASKS_CRON_SECRET')?.trim(),
  ].filter((s): s is string => Boolean(s && s.length > 0));

  if (configuredSecrets.length > 0) {
    const headerSecret = req.headers.get('x-cron-secret')?.trim();
    const bearerSecret = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
    const apiKeySecret = req.headers.get('apikey')?.trim();
    const providedSecret = headerSecret ?? bearerSecret ?? apiKeySecret;
    const isAuthorized = !!providedSecret && configuredSecrets.some((s) => s === providedSecret);
    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  try {
    // Fetch only unique timezones first (light query), then per-timezone task queries,
    // and finally only fetch subscriptions for users who have tasks due.
    const { data: timezoneRows, error: timezoneError } = await supabase
      .from('push_subscriptions')
      .select('timezone, user_id')
      .not('user_id', 'is', null);

    if (timezoneError) throw timezoneError;

    const timezoneRows2 = ((timezoneRows ?? []) as any[]).filter((r) => r.user_id);

    if (!timezoneRows2.length) {
      return new Response(JSON.stringify({ ok: true, results: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build timezone → userIds map (no subscription keys fetched yet)
    const userIdsByTimezone = new Map<string, string[]>();
    for (const row of timezoneRows2) {
      const tz = (row.timezone as string | null)?.trim() || 'UTC';
      if (!userIdsByTimezone.has(tz)) userIdsByTimezone.set(tz, []);
      userIdsByTimezone.get(tz)!.push(row.user_id as string);
    }

    const results: any[] = [];

    for (const [tz, tzUserIds] of userIdsByTimezone.entries()) {
      try {
        const now = new Date();
        // Build all candidate (date, time) pairs for all offsets in this TZ.
        // One batched query instead of 6 separate queries.
        type Candidate = { E: number; targetDate: string; targetTime: string; targetTimeSec: string };
        const candidates: Candidate[] = EARLY_OFFSETS.map((E) => {
          const target = new Date(now.getTime() + E * 60 * 1000);
          const targetDate = formatInTz(target, tz, 'date');
          const targetTime = formatInTz(target, tz, 'time');
          return { E, targetDate, targetTime, targetTimeSec: `${targetTime}:00` };
        });

        // Collect unique (date, time) values across all offsets.
        const uniqueDates = [...new Set(candidates.map((c) => c.targetDate))];
        const uniqueTimes = [...new Set(candidates.flatMap((c) => [c.targetTime, c.targetTimeSec]))];
        const uniqueUserIds = [...new Set(tzUserIds)];

        const { data: allTasks, error: allTasksError } = await supabase
          .from('tasks')
          .select('id, title, user_id, due_date, due_time, reminders_enabled, early_reminder_minutes')
          .eq('is_completed', false)
          .eq('is_wont_do', false)
          .eq('reminders_enabled', true)
          .in('due_date', uniqueDates)
          .in('due_time', uniqueTimes)
          .in('user_id', uniqueUserIds)
          .is('parent_id', null);

        if (allTasksError) {
          console.error(`Error querying tasks for ${tz}:`, allTasksError);
          continue;
        }

        // Match tasks to their offset candidate and deduplicate.
        const taskIdSeen = new Set<string>();
        const taskList: any[] = [];
        for (const { E, targetDate, targetTime, targetTimeSec } of candidates) {
          const raw = ((allTasks as any[]) || []).filter((t: any) =>
            t.due_date === targetDate &&
            (t.due_time === targetTime || t.due_time === targetTimeSec)
          );
          const toAdd = E === 0
            ? raw.filter((t: any) => t.early_reminder_minutes == null || t.early_reminder_minutes === 0)
            : raw.filter((t: any) => t.early_reminder_minutes === E);
          for (const t of toAdd) {
            if (!taskIdSeen.has(t.id)) {
              taskIdSeen.add(t.id);
              taskList.push(t);
            }
          }
        }

        if (taskList.length === 0) continue;

        // Lazily fetch subscriptions ONLY for users who have due tasks — not the full table.
        const dueUserIds = [...new Set(taskList.map((t: any) => t.user_id).filter(Boolean))];
        const { data: subRows, error: subError } = await supabase
          .from('push_subscriptions')
          .select('endpoint, p256dh, auth, user_id')
          .in('user_id', dueUserIds);

        if (subError) {
          console.error(`Error fetching subscriptions for ${tz}:`, subError);
          continue;
        }

        // Group subscriptions by user_id
        const subsByUser = new Map<string, any[]>();
        for (const sub of ((subRows ?? []) as any[])) {
          if (sub.user_id && sub.endpoint && sub.p256dh && sub.auth) {
            const list = subsByUser.get(sub.user_id) || [];
            list.push(sub);
            subsByUser.set(sub.user_id, list);
          }
        }

        let sent = 0;
        for (const task of taskList) {
          if (!task.user_id) continue;

          const idempotencyKey = `task:${task.user_id}:${task.id}:${tz}:${task.due_date}:${task.due_time}`;
          const userSubs = subsByUser.get(task.user_id) || [];
          if (!userSubs.length) continue;

          const isAr = /[\u0600-\u06FF]/.test(task.title);
          const titleText = isAr
            ? `يلا عشان وراك مهمة ${task.title}`
            : `Ready to tackle ${task.title}`;

          const payload = JSON.stringify({
            taskId: task.id,
            title: titleText,
            body: isAr
              ? `تذكير بمهمة: ${task.title}`
              : `Reminder for task: ${task.title}`
          });
          let anySuccess = false;
          for (const sub of userSubs) {
            try {
              await webpush.sendNotification(
                {
                  endpoint: sub.endpoint,
                  keys: { p256dh: sub.p256dh, auth: sub.auth },
                },
                payload
              );
              sent++;
              anySuccess = true;
            } catch (e) {
              console.error('Push failed', sub.endpoint.slice(0, 50), e);
              if ((e as any).statusCode === 410 || (e as any).statusCode === 404) {
                await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
              }
            }
          }
        }
        results.push({ timezone: tz, tasks: taskList.length, sent });
      } catch (tzProcError) {
        console.error(`Failed to process timezone ${tz}`, tzProcError);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
